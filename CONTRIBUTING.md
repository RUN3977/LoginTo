# Contributing to LoginTo

## Welcome! 🎉

Thank you for your interest in contributing to LoginTo. We appreciate your help in making this project better.

## Code of Conduct

Please be respectful and constructive in all interactions.

## How to Contribute

### Report a Bug 🐛

1. Go to [Issues](https://github.com/RUN3977/LoginTo/issues)
2. Click "New Issue"
3. Use the bug report template
4. Include:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - System info (OS, Flutter version, etc.)

### Suggest a Feature ✨

1. Go to [Discussions](https://github.com/RUN3977/LoginTo/discussions)
2. Describe your idea
3. Discuss with the community
4. Once approved, create a GitHub Issue

### Improve Documentation 📖

1. Fork the repository
2. Make changes to `.md` files
3. Submit a PR with clear description

### Contribute Code 🔧

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Add tests for new functionality
5. Run: `flutter test`
6. Commit with clear message
7. Push to your fork
8. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/LoginTo.git
cd LoginTo

# Install dependencies
flutter pub get
flutter pub run build_runner build

# Run the app
flutter run

# Run tests
flutter test
```

## Testing

- Write unit tests for core logic
- Write widget tests for UI components
- Run `flutter test --coverage` before submitting
- Aim for >80% code coverage

## Pull Request Process

1. Update `README.md` if needed
2. Ensure tests pass: `flutter test`
3. Check code style: `flutter analyze`
4. Format code: `dart format .`
5. Write clear PR description
6. Link related issues

## Coding Standards

- Follow [Effective Dart](https://dart.dev/guides/language/effective-dart)
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused
- Don't commit sensitive information

## Security Issues

For security vulnerabilities, **DO NOT** create a public issue.

Email: `security@loginto.app`

Include:
- Description of vulnerability
- Potential impact
- Steps to reproduce (if applicable)
- Suggested fix (if any)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- Open a [Discussion](https://github.com/RUN3977/LoginTo/discussions)
- Check existing [Issues](https://github.com/RUN3977/LoginTo/issues)
- Read the [docs](https://github.com/RUN3977/LoginTo/tree/main/docs)

Happy contributing! 🚀
