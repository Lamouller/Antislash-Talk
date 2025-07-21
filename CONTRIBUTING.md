# 🤝 Contributing to Talk-2-Web

Thank you for your interest in contributing to Talk-2-Web! We welcome contributions from developers of all skill levels.

## 🌟 Ways to Contribute

- **🐛 Bug Reports**: Help us identify and fix issues
- **💡 Feature Requests**: Suggest new functionality
- **📝 Documentation**: Improve guides and documentation
- **🔧 Code Contributions**: Fix bugs, add features, optimize performance
- **🎨 UI/UX Improvements**: Enhance user experience
- **🧪 Testing**: Add tests, improve coverage
- **🌍 Translations**: Help make Talk-2-Web accessible globally

## 🚀 Quick Start for Contributors

### 1. Fork & Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/yourusername/Talk-2-Web.git
cd Talk-2-Web
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Start development server
npm run dev
```

### 3. Create a Feature Branch

```bash
git checkout -b feature/amazing-feature
# or
git checkout -b fix/bug-description
```

## 📋 Development Guidelines

### Code Style

We use **ESLint** and **Prettier** for consistent code formatting:

```bash
# Check linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format
```

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add Voxtral model support
fix: resolve WebGPU loading issues
docs: update deployment guide
style: improve button accessibility
refactor: simplify audio processing logic
test: add transcription unit tests
```

### TypeScript

- ✅ Use strict TypeScript
- ✅ Properly type all props and functions
- ✅ Avoid `any` types when possible
- ✅ Use interfaces for complex objects

```typescript
// Good
interface TranscriptionResult {
  text: string;
  duration: number;
  chunks?: TranscriptionChunk[];
}

// Avoid
const result: any = transcriptionData;
```

### React Best Practices

- ✅ Use functional components with hooks
- ✅ Implement proper error boundaries
- ✅ Use custom hooks for shared logic
- ✅ Minimize re-renders with useMemo/useCallback

```typescript
// Good
const MyComponent: React.FC<Props> = ({ data }) => {
  const processedData = useMemo(() => 
    expensiveCalculation(data), [data]
  );
  
  return <div>{processedData}</div>;
};
```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI elements
│   ├── auth/           # Authentication components
│   ├── layout/         # Layout components
│   ├── meetings/       # Meeting-related components
│   └── recording/      # Recording interface
├── hooks/              # Custom React hooks
│   ├── useLocalTranscription.ts
│   ├── useWebAudioRecorder.ts
│   └── useWebAudioPlayer.ts
├── lib/                # Core utilities
│   ├── supabase.ts     # Database client
│   ├── schemas.ts      # Type definitions
│   └── utils.ts        # Helper functions
├── pages/              # App pages/routes
│   ├── (tabs)/         # Main app tabs
│   ├── auth/           # Authentication pages
│   └── meeting/        # Meeting pages
└── main.tsx            # App entry point
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Writing Tests

```typescript
// Component tests
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// Hook tests
import { renderHook } from '@testing-library/react';
import { useLocalTranscription } from './useLocalTranscription';

describe('useLocalTranscription', () => {
  it('handles transcription correctly', () => {
    const { result } = renderHook(() => useLocalTranscription());
    expect(result.current.isTranscribing).toBe(false);
  });
});
```

## 🎯 Feature Development

### Adding New AI Models

1. **Update model definitions** in `src/pages/(tabs)/settings.tsx`
2. **Implement model loading** in `src/hooks/useLocalTranscription.ts`
3. **Add model-specific configuration** if needed
4. **Test with different device capabilities**
5. **Update documentation**

### Adding New Providers

1. **Define provider type** in settings types
2. **Add provider models** to transcriptionModels
3. **Implement provider logic** in transcription hooks
4. **Add API key management** if needed
5. **Create provider-specific components** if required

### Performance Optimization

- 🔍 Use React DevTools Profiler
- 📊 Monitor bundle size with `npm run analyze`
- ⚡ Optimize WebGPU usage for AI models
- 🚀 Implement lazy loading for heavy components

## 🐛 Bug Reporting

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Test with latest version** of Talk-2-Web
3. **Check browser compatibility** (Chrome recommended)
4. **Verify WebGPU support** if AI-related

### Bug Report Template

```markdown
**Bug Description**
A clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14.1]
- Device: [e.g., MacBook Pro M2]
- WebGPU: [Enabled/Disabled]

**Additional Context**
Any other relevant information.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Feature Description**
A clear description of the feature.

**Problem Solved**
What problem does this solve?

**Proposed Solution**
How would you like it to work?

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Screenshots, mockups, or examples.
```

## 🚀 Pull Request Process

### Before Submitting

1. **Update your fork** with latest main branch
2. **Test your changes** thoroughly
3. **Run linting and tests** (`npm run lint && npm test`)
4. **Update documentation** if needed
5. **Add changeset** for user-facing changes

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Cross-browser testing (if UI changes)

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed the code
- [ ] Added tests for new functionality
- [ ] Updated documentation
- [ ] No breaking changes without discussion
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **At least one maintainer review** required
3. **Address feedback** promptly and respectfully
4. **Squash commits** before merging (if requested)

## 🎨 Design Guidelines

### UI/UX Principles

- **🎯 User-focused**: Prioritize user needs and workflows
- **🔒 Privacy-first**: Make local processing options prominent
- **⚡ Performance**: Optimize for speed and responsiveness
- **♿ Accessible**: Follow WCAG 2.1 guidelines
- **📱 Responsive**: Work great on all device sizes

### Visual Design

- **Colors**: Use the existing design system
- **Typography**: Consistent font hierarchy
- **Spacing**: Follow 8px grid system
- **Icons**: Use consistent icon library
- **Motion**: Subtle, purposeful animations

## 🌍 Internationalization

### Adding New Languages

1. **Create language file** in `src/locales/[lang].json`
2. **Translate all strings** following existing patterns
3. **Test UI layout** with longer/shorter text
4. **Update language selector** component
5. **Add RTL support** if needed

### Translation Guidelines

- **Context matters**: Provide context for translators
- **Technical terms**: Keep consistent across languages
- **UI constraints**: Consider text length in UI
- **Cultural adaptation**: Adapt to local conventions

## 🛡️ Security

### Security Best Practices

- **🔐 API Keys**: Never commit API keys to repository
- **🛡️ Input Validation**: Validate all user inputs
- **🔒 XSS Prevention**: Sanitize dynamic content
- **🚫 Dependencies**: Keep dependencies updated
- **📝 Audit**: Regular security audits

### Reporting Security Issues

**Please DO NOT create public issues for security vulnerabilities.**

Instead, email us at: **security@talk2web.com**

## 📞 Getting Help

### Community Support

- **💬 GitHub Discussions**: [Ask questions and share ideas](https://github.com/yourusername/Talk-2-Web/discussions)
- **🐛 Issues**: [Report bugs and request features](https://github.com/yourusername/Talk-2-Web/issues)
- **📚 Documentation**: [Read the full documentation](https://github.com/yourusername/Talk-2-Web/wiki)

### Maintainer Contact

- **Technical questions**: Create a GitHub Discussion
- **Security issues**: security@talk2web.com
- **Partnership inquiries**: hello@talk2web.com

## 🏆 Recognition

### Contributors

All contributors are recognized in:
- **README.md** contributors section
- **CHANGELOG.md** for significant contributions
- **GitHub contributors** page

### Contribution Types

We recognize all types of contributions using the [All Contributors](https://allcontributors.org/) specification:

- 💻 Code
- 📖 Documentation
- 🎨 Design
- 🐛 Bug reports
- 💡 Ideas
- 🤔 Answering Questions
- ⚠️ Tests
- 🌍 Translation

## 📄 License

By contributing to Talk-2-Web, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Talk-2-Web! Together, we're building the future of AI-powered conversation analysis.** 🎙️✨ 