# Contributing to Research Article Template

Thank you for your interest in contributing to the Research Article Template! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

Before creating an issue, please:
1. **Search existing issues** to avoid duplicates
2. **Use the issue template** when available
3. **Provide detailed information**:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node.js version, browser)
   - Screenshots if applicable

### Suggesting Features

We welcome feature suggestions! Please:
1. **Check existing discussions** first
2. **Describe the use case** clearly
3. **Explain the benefits** for the community
4. **Consider implementation complexity**

### Code Contributions

#### Getting Started

1. **Fork the repository** on Hugging Face
2. **Clone your fork**:
   ```bash
   git clone git@hf.co:spaces/<your-username>/research-article-template
   cd research-article-template
   ```
3. **Install dependencies**:
   ```bash
   cd app
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Workflow

1. **Make your changes** following our coding standards
2. **Test thoroughly**:
   ```bash
   npm run dev    # Test locally
   npm run build  # Ensure build works
   ```
3. **Update documentation** if needed
4. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add new component for interactive charts"
   ```

#### Pull Request Process

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```
2. **Create a Pull Request** with:
   - Clear title and description
   - Reference related issues
   - Screenshots for UI changes
   - Testing instructions

## 📋 Coding Standards

### Code Style

- **Use Prettier** for consistent formatting
- **Follow existing patterns** in the codebase
- **Write clear, self-documenting code**
- **Add comments** for complex logic
- **Use meaningful variable names**

### File Organization

- **Components**: Place in `src/components/`
- **Styles**: Use CSS modules or component-scoped styles
- **Assets**: Organize in `src/content/assets/`
- **Documentation**: Update relevant `.mdx` files

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat: add new interactive chart component
fix: resolve mobile layout issues
docs: update installation instructions
style: improve button hover states
refactor: simplify component structure
test: add unit tests for utility functions
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 🧪 Testing

### Manual Testing

Before submitting:
- [ ] Test on different screen sizes
- [ ] Verify dark/light theme compatibility
- [ ] Check browser compatibility (Chrome, Firefox, Safari)
- [ ] Test with different content types
- [ ] Ensure accessibility standards

### Automated Testing

```bash
# Run build to catch errors
npm run build

# Test PDF export
npm run export:pdf

# Test LaTeX conversion
npm run latex:convert
```

## 📚 Documentation

### Writing Guidelines

- **Use clear, concise language**
- **Provide examples** for complex features
- **Include screenshots** for UI changes
- **Update both English content and code comments**

### Documentation Structure

- **README.md**: Project overview and quick start
- **CONTRIBUTING.md**: This file
- **Content files**: In `src/content/chapters/demo/`
- **Component docs**: Inline comments and examples

## 🎯 Areas for Contribution

### High Priority

- **Bug fixes** and stability improvements
- **Accessibility enhancements**
- **Mobile responsiveness**
- **Performance optimizations**
- **Documentation improvements**

### Feature Ideas

- **New interactive components**
- **Additional export formats**
- **Enhanced LaTeX import**
- **Theme customization**
- **Plugin system**

### Community

- **Answer questions** in discussions
- **Share examples** of your work
- **Write tutorials** and guides
- **Help with translations**

## 🚫 What Not to Contribute

- **Breaking changes** without discussion
- **Major architectural changes** without approval
- **Dependencies** that significantly increase bundle size
- **Features** that don't align with the project's goals

## 📞 Getting Help

- **Discussions**: [Community tab](https://huggingface.co/spaces/tfrere/research-article-template/discussions)
- **Issues**: [Report bugs](https://huggingface.co/spaces/tfrere/research-article-template/discussions?status=open&type=issue)
- **Contact**: [@tfrere](https://huggingface.co/tfrere) on Hugging Face

## 📄 License

By contributing, you agree that your contributions will be licensed under the same [CC-BY-4.0 license](LICENSE) that covers the project.

## 🙏 Recognition

Contributors will be:
- **Listed in acknowledgments** (if desired)
- **Mentioned in release notes** for significant contributions
- **Credited** in relevant documentation

Thank you for helping make scientific writing more accessible and interactive! 🎉
