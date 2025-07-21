# 🎙️ Talk-2-Web

**AI-Powered Meeting Transcription & Analysis Platform**

Transform your voice recordings into intelligent insights with advanced AI transcription, semantic understanding, and automated analysis.

![Talk-2-Web Interface](https://img.shields.io/badge/TypeScript-React-blue) ![AI Powered](https://img.shields.io/badge/AI-Voxtral%20%7C%20Whisper-green) ![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20Option-orange)

## 🌟 Features

### 🎯 **Multiple Transcription Providers**
- **🔒 Local Processing** - 100% private with Whisper, Moonshine models
- **🎯 Mistral Voxtral** - Revolutionary multimodal AI with semantic understanding
- **🤖 OpenAI Whisper** - Industry-standard cloud transcription
- **🧠 Google Gemini** - Advanced multimodal capabilities

### 🚀 **Advanced Capabilities**
- **🎙️ Superior Transcription** - Voxtral outperforms Whisper on all benchmarks
- **🧠 Semantic Understanding** - Built-in Q&A and content analysis
- **🌍 Multilingual Support** - Auto-detection of 99+ languages
- **🔧 Function Calling** - Voice commands directly from audio
- **📝 Smart Enhancement** - Automated titles, summaries, and insights
- **🎯 Device Optimization** - Automatic model recommendations

### 🛡️ **Privacy & Security**
- **Local-first architecture** - Process sensitive data entirely offline
- **Encrypted API storage** - Secure cloud options when needed
- **No vendor lock-in** - Open-source with flexible deployment

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Supabase** account (free tier available)
- **Modern browser** with WebGPU support (Chrome recommended)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/Talk-2-Web.git
cd Talk-2-Web
npm install
```

### 2. Environment Setup

Create `.env.local`:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Pre-configure API Keys
VITE_MISTRAL_API_KEY=your_mistral_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_GOOGLE_API_KEY=your_google_api_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Supabase Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 4. Start Development

```bash
npm run dev
```

Visit `http://localhost:5173` and start transcribing! 🎉

## 🏗️ Production Deployment

### Option 1: Netlify (Recommended)

1. **Build the project:**
```bash
npm run build
```

2. **Deploy to Netlify:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

3. **Configure environment variables** in Netlify dashboard.

### Option 2: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Option 3: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "preview"]
```

```bash
# Build and run
docker build -t talk-2-web .
docker run -p 3000:3000 talk-2-web
```

### Option 4: Self-Hosted

```bash
# Build for production
npm run build

# Serve with any static server
npx serve dist
# or
python -m http.server 3000 -d dist
```

## ⚙️ Configuration

### Transcription Providers

| Provider | Models Available | Use Case | Setup Required |
|----------|------------------|----------|----------------|
| **Local** | Whisper, Moonshine, Distil-Whisper | 100% Privacy | None (runs in browser) |
| **Mistral** | Voxtral Small/Mini | Advanced AI features | Mistral API key |
| **OpenAI** | Whisper-1 | Reliable cloud option | OpenAI API key |
| **Google** | Gemini 1.5 Pro/Flash | Multimodal capabilities | Google AI API key |

### Device Recommendations

The app automatically detects your device capabilities and recommends the best local models:

- **🚀 High-end (16GB+ RAM, 8+ cores)**: Distil-Whisper Large
- **⚡ Mid-range (8GB+ RAM, 4+ cores)**: Whisper Base  
- **💻 Low-end devices**: Moonshine Tiny

### API Keys Configuration

Add your API keys in **Settings → API Keys** or via environment variables:

1. **Mistral API** (for Voxtral): [console.mistral.ai](https://console.mistral.ai)
2. **OpenAI API**: [platform.openai.com](https://platform.openai.com)
3. **Google AI**: [aistudio.google.com](https://aistudio.google.com/app/apikey)
4. **Anthropic API**: [console.anthropic.com](https://console.anthropic.com)

## 🛠️ Development

### Project Structure

```
Talk-2-Web/
├── src/
│   ├── components/       # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   │   ├── useLocalTranscription.ts  # Local AI processing
│   │   ├── useWebAudioRecorder.ts   # Audio recording
│   │   └── useWebAudioPlayer.ts     # Audio playback
│   ├── lib/             # Core utilities
│   │   ├── supabase.ts  # Database client
│   │   └── schemas.ts   # Type definitions
│   ├── pages/           # App pages/routes
│   └── main.tsx         # App entry point
├── supabase/            # Database schema & functions
├── netlify/             # Serverless functions
└── public/              # Static assets
```

### Key Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + Custom components
- **State**: React hooks + local storage
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: Transformers.js + WebGPU
- **Audio**: Web Audio API + MediaRecorder
- **Routing**: React Router v6

### Local Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build
npm run lint            # Run ESLint

# Supabase
supabase start          # Start local Supabase
supabase db push        # Apply migrations
supabase gen types      # Generate TypeScript types

# Testing
npm run test            # Run tests
npm run test:e2e        # End-to-end tests
```

## 📊 Performance Optimization

### WebGPU Acceleration

For optimal performance on supported devices:

1. **Enable WebGPU** in Chrome: `chrome://flags/#enable-webgpu`
2. **Apple Silicon Macs**: Native WebGPU support
3. **Windows/Linux**: Requires compatible GPU drivers

### Model Selection Guide

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| Moonshine Tiny | 50MB | ⚡⚡⚡ | ⭐⭐ | Mobile, quick tests |
| Whisper Tiny | 39MB | ⚡⚡ | ⭐⭐⭐ | Balanced local option |
| Whisper Base | 74MB | ⚡ | ⭐⭐⭐⭐ | Recommended local |
| Distil-Whisper Large | 756MB | ⚡ | ⭐⭐⭐⭐⭐ | High-end local |
| Voxtral Mini | API | ⚡⚡ | ⭐⭐⭐⭐⭐ | Cloud + AI features |

## 🔧 Troubleshooting

### Common Issues

**Model Loading Fails:**
```bash
# Clear browser cache and storage
# Try smaller model (Whisper Tiny)
# Check WebGPU support in chrome://gpu
```

**WebGPU Not Working:**
```bash
# Enable in chrome://flags/#enable-webgpu
# Update GPU drivers
# Try WASM fallback mode
```

**API Key Errors:**
```bash
# Verify key in Settings → API Keys
# Check API quotas and billing
# Test with different model
```

**Build Issues:**
```bash
npm run clean           # Clear node_modules
npm install             # Reinstall dependencies
npm run build           # Rebuild
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test locally
4. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
5. Push and create Pull Request

### Code Standards

- **TypeScript** strict mode
- **ESLint** + Prettier formatting
- **Component-first** architecture
- **Accessibility** (WCAG 2.1)
- **Performance** optimizations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Mistral AI** for revolutionary Voxtral models
- **OpenAI** for Whisper speech recognition
- **Hugging Face** for Transformers.js
- **Supabase** for backend infrastructure
- **Useful Sensors** for Moonshine models

## 🆘 Support

- **📚 Documentation**: [Wiki](https://github.com/yourusername/Talk-2-Web/wiki)
- **🐛 Bug Reports**: [Issues](https://github.com/yourusername/Talk-2-Web/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/yourusername/Talk-2-Web/discussions)
- **📧 Email**: support@talk2web.com

---

**Built with ❤️ by the Talk-2-Web Team**

*Transform conversations into insights with the power of AI*
