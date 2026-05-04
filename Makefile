SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c

.DEFAULT_GOAL := help

# Repository / deployment configuration (override at invocation time)
REPO_DIR ?= $(CURDIR)
BRANCH ?= main
GIT_URL ?= https://github.com/wg-lux/lx-annotate.git
REMOTE ?= origin

# Tooling
DEVENV ?= devenv
GIT ?= git
MKDIR_P ?= mkdir -p
CACHE_DIR ?= $(REPO_DIR)/.make-cache
FRONTEND_HASH_FILE ?= $(CACHE_DIR)/frontend-src.sha256
MIGRATIONS_HASH_FILE ?= $(CACHE_DIR)/migrations.sha256

# Helper: run commands inside the devenv environment
ifneq ($(DEVENV_PROFILE),)
DEVENV_RUN ?=
else
DEVENV_RUN ?= $(DEVENV) shell --
endif

package: $(DEVENV_RUN) python -m build