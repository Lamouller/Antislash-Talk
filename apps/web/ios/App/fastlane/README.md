fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios build

```sh
[bundle exec] fastlane ios build
```

Build l'app pour le développement

### ios device

```sh
[bundle exec] fastlane ios device
```

Build et installe sur un appareil connecté

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Archive et envoie sur TestFlight (beta)

### ios release

```sh
[bundle exec] fastlane ios release
```

Archive et publie sur l'App Store

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

Génère les screenshots pour l'App Store

### ios clean

```sh
[bundle exec] fastlane ios clean
```

Nettoie le projet

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
