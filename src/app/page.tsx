import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  MessageCircle, 
  BookOpen, 
  TrendingUp, 
  Target,
  Mic,
  BarChart3,
  Clock,
  Star,
  ArrowRight,
  Play
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: <MessageCircle className="w-8 h-8 text-blue-600" />,
      title: "AI Conversation Practice",
      description: "Practice real conversations with our intelligent AI tutor that adapts to your level"
    },
    {
      icon: <BookOpen className="w-8 h-8 text-green-600" />,
      title: "Weekly Vocabulary",
      description: "Learn new words each week with personalized difficulty based on your progress"
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-purple-600" />,
      title: "Progress Tracking",
      description: "Beautiful visualizations show your improvement in clarity, fluency, and vocabulary"
    },
    {
      icon: <Target className="w-8 h-8 text-orange-600" />,
      title: "Real-time Feedback",
      description: "Get instant feedback on pronunciation, grammar, and conversation flow"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Software Engineer",
      content: "ImprovToday helped me gain confidence in English conversations at work. The AI feedback is incredibly detailed!",
      rating: 5
    },
    {
      name: "Carlos Rodriguez",
      role: "Business Student",
      content: "The vocabulary tracking feature is amazing. I can see exactly which words I've mastered and which need more practice.",
      rating: 5
    },
    {
      name: "Yuki Tanaka",
      role: "Marketing Professional",
      content: "Perfect for busy professionals. I practice during my commute and track my progress over time.",
      rating: 5
    }
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
            Improve Your English
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {" "}Speaking{" "}
            </span>
            Every Day
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Practice conversational English with AI, track your progress with beautiful visualizations, 
            and build confidence through daily vocabulary learning.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/practice">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-3">
                <Play className="w-5 h-5 mr-2" />
                Start Practicing Now
              </Button>
            </Link>
            
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-3">
                <BarChart3 className="w-5 h-5 mr-2" />
                View Demo Dashboard
              </Button>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">10K+</div>
              <div className="text-sm text-gray-600">Conversations Practiced</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">95%</div>
              <div className="text-sm text-gray-600">User Satisfaction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">50+</div>
              <div className="text-sm text-gray-600">Practice Topics</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Improve
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our comprehensive platform combines AI technology with proven language learning methods
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Get started in minutes and see improvement in days
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                1. Choose a Topic
              </h3>
              <p className="text-gray-600">
                Select from 50+ conversation topics or practice with your weekly vocabulary words
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                2. Start Talking
              </h3>
              <p className="text-gray-600">
                Have natural conversations with our AI tutor that responds intelligently to your speech
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                3. Track Progress
              </h3>
              <p className="text-gray-600">
                Monitor your improvement with detailed analytics and personalized feedback
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What Our Users Say
            </h2>
            <p className="text-gray-600">
              Join thousands of learners improving their English every day
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6">
                <div className="mb-4 flex">
                  {renderStars(testimonial.rating)}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {testimonial.role}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Your English Journey?
          </h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of learners who are improving their English speaking skills every day
          </p>
          
          <Link href="/practice">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
              Start Your First Practice Session
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">ImprovToday</h3>
              <p className="text-gray-400 text-sm">
                Helping you improve your English speaking skills through AI-powered conversations and personalized learning.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Practice</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/practice" className="text-gray-400 hover:text-white">Conversation Practice</Link></li>
                <li><Link href="/practice" className="text-gray-400 hover:text-white">Vocabulary Learning</Link></li>
                <li><Link href="/practice" className="text-gray-400 hover:text-white">Pronunciation Training</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Progress</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/dashboard" className="text-gray-400 hover:text-white">Dashboard</Link></li>
                <li><Link href="/dashboard" className="text-gray-400 hover:text-white">Analytics</Link></li>
                <li><Link href="/dashboard" className="text-gray-400 hover:text-white">Achievements</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-gray-400 hover:text-white">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Contact Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2024 ImprovToday. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
