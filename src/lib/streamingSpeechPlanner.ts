/**
 * Streaming Speech Planner
 *
 * Parses streaming SSE text containing inline markup tags ([pause:*], [volume:*])
 * and builds sentence-aligned speech directives for progressive speech synthesis.
 */

export interface SpeechDirective {
  text: string;
  pauseBefore?: number; // milliseconds
  pauseAfter?: number;  // milliseconds
  volume?: number;      // 0.0 - 1.0
}

export interface ParseResult {
  directives: SpeechDirective[];
  partialBuffer: string; // Incomplete text waiting for more chunks
}

/**
 * Parse streaming text chunk and extract speech directives.
 * Handles incomplete tags by buffering until complete.
 */
export function parseStreamingChunk(
  chunk: string,
  previousBuffer: string = ''
): ParseResult {
  const fullText = previousBuffer + chunk;
  const directives: SpeechDirective[] = [];
  let currentText = '';
  let currentVolume = 1.0;
  let pauseAfter = 0;
  let i = 0;

  // Check if we have incomplete tag at the end
  const incompleteTagMatch = fullText.match(/\[(?:pause|volume)(?::[^\]]*)?$/);
  const processableText = incompleteTagMatch
    ? fullText.slice(0, incompleteTagMatch.index)
    : fullText;
  const partialBuffer = incompleteTagMatch ? fullText.slice(incompleteTagMatch.index!) : '';

  while (i < processableText.length) {
    const remaining = processableText.slice(i);

    // Match [pause:0.4s] or [volume:soft]
    const tagMatch = remaining.match(/^\[(?:pause|volume):([^\]]+)\]/);

    if (tagMatch) {
      const [fullMatch, value] = tagMatch;
      const tagType = fullMatch.startsWith('[pause') ? 'pause' : 'volume';

      if (tagType === 'pause') {
        // Parse pause duration (e.g., "0.4s" -> 400ms)
        const duration = parseFloat(value.replace('s', '')) * 1000;
        pauseAfter = duration;
      } else if (tagType === 'volume') {
        // Parse volume (soft, normal, loud)
        currentVolume = parseVolume(value);
      }

      i += fullMatch.length;
    } else if (remaining[0] === '[') {
      // Might be start of incomplete tag, skip it
      i++;
    } else {
      // Regular text - accumulate until sentence boundary or another tag
      const nextTagIndex = remaining.slice(1).search(/\[/);
      const endIndex = nextTagIndex === -1 ? remaining.length : nextTagIndex + 1;
      const textChunk = remaining.slice(0, endIndex);

      currentText += textChunk;
      i += textChunk.length;

      // Check if we hit a sentence boundary
      const sentenceMatch = currentText.match(/[.!?]\s*$/);
      if (sentenceMatch) {
        // Flush current directive
        if (currentText.trim()) {
          const directive: SpeechDirective = {
            text: currentText.trim(),
            volume: currentVolume,
          };
          if (pauseAfter > 0) {
            directive.pauseAfter = pauseAfter;
          }
          directives.push(directive);
          currentText = '';
          pauseAfter = 0;
        }
      }
    }
  }

  // If there's remaining text (incomplete sentence), keep it in buffer for next chunk
  const finalBuffer = currentText ? currentText + partialBuffer : partialBuffer;

  return {
    directives,
    partialBuffer: finalBuffer,
  };
}

/**
 * Parse volume string to numeric value
 */
function parseVolume(volumeStr: string): number {
  const normalized = volumeStr.toLowerCase().trim();
  switch (normalized) {
    case 'soft':
    case 'quiet':
    case 'whisper':
      return 0.5;
    case 'loud':
    case 'emphasis':
    case 'strong':
      return 1.0;
    case 'normal':
    case 'medium':
    default:
      return 0.8;
  }
}

/**
 * Flush any remaining buffered text as final directive
 */
export function flushBuffer(buffer: string, volume: number = 0.8): SpeechDirective | null {
  if (!buffer.trim()) return null;

  return {
    text: buffer.trim(),
    volume,
  };
}

/**
 * Strip all markup tags from text (for display purposes)
 */
export function stripMarkup(text: string): string {
  return text.replace(/\[(?:pause|volume):[^\]]+\]/g, '');
}

/**
 * Generate mood-based "thinking" filler based on emotion
 */
export function getThinkingFiller(mood?: string): string {
  const fillers: Record<string, string[]> = {
    happy: ['Mm-hmm...', 'Oh!', 'Interesting...'],
    sad: ['Mm...', 'Yeah...', '...'],
    stressed: ['Uh...', 'Right...', 'So...'],
    sassy: ['Well...', 'Hm.', 'Okay...'],
    calm: ['I see...', 'Mm...', 'Right...'],
  };

  const options = fillers[mood || 'calm'] || fillers.calm;
  return options[Math.floor(Math.random() * options.length)];
}
