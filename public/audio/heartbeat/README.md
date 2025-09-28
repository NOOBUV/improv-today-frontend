# Heartbeat Audio System

This system uses **synthetic heartbeat audio** generated in real-time using the Web Audio API.

## Current Implementation

The system generates synthetic heartbeat sounds with:
- **Realistic double-pulse pattern** ("lub-dub")
- **Mood-specific BPM timing** (45-100 BPM based on emotional state)
- **Conversation intensity multipliers** (0.9x to 1.3x speed adjustments)
- **Dynamic timing changes** in real-time based on conversation flow

## Synthetic Audio Benefits

- ✅ **No file dependencies** - Works without external audio files
- ✅ **Perfect synchronization** - Generated to match exact BPM requirements
- ✅ **Real-time adaptation** - Instantly adjusts to mood and intensity changes
- ✅ **Consistent quality** - Same audio experience across all devices
- ✅ **No loading errors** - Never fails due to missing files

## Optional File Support

If you want to use custom audio files instead, you can add:
- `neutral.mp3`, `happy.mp3`, `excited.mp3`, `calm.mp3`
- `angry.mp3`, `sad.mp3`, `frustrated.mp3`, `surprised.mp3`

The system will automatically detect and use them, but synthetic generation is the default.

## Volume and Accessibility

- Default volume: 30%
- Includes mute functionality
- Respects user audio preferences
- Graceful degradation on older devices