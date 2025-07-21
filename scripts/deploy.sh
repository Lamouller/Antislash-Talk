#!/bin/bash

# 🎙️ Antislash Talk Deployment Script
# Automated deployment for various platforms

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="talk-2-web"
BUILD_DIR="dist"
DOCKER_IMAGE="talk2web:latest"

# Functions
print_header() {
    echo -e "${BLUE}🎙️ Antislash Talk Deployment Script${NC}"
    echo -e "${BLUE}=================================${NC}\n"
}

print_step() {
    echo -e "${YELLOW}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_dependencies() {
    print_step "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

install_dependencies() {
    print_step "Installing dependencies..."
    npm ci --silent
    print_success "Dependencies installed"
}

build_project() {
    print_step "Building project..."
    npm run build
    
    if [ ! -d "$BUILD_DIR" ]; then
        print_error "Build failed - $BUILD_DIR directory not found"
        exit 1
    fi
    
    print_success "Project built successfully"
}

deploy_netlify() {
    print_step "Deploying to Netlify..."
    
    if ! command -v netlify &> /dev/null; then
        print_step "Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    netlify deploy --prod --dir=$BUILD_DIR
    print_success "Deployed to Netlify"
}

deploy_vercel() {
    print_step "Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        print_step "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    vercel --prod
    print_success "Deployed to Vercel"
}

deploy_docker() {
    print_step "Building Docker image..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    docker build -t $DOCKER_IMAGE .
    print_success "Docker image built: $DOCKER_IMAGE"
    
    print_step "Starting Docker container..."
    docker run -d -p 3000:80 --name $PROJECT_NAME $DOCKER_IMAGE
    print_success "Container started on http://localhost:3000"
}

deploy_docker_compose() {
    print_step "Deploying with Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    docker-compose up -d
    print_success "Deployed with Docker Compose"
    print_success "Application: http://localhost:3000"
    print_success "Database: postgresql://localhost:5432"
}

setup_environment() {
    print_step "Setting up environment..."
    
    if [ ! -f ".env.local" ]; then
        print_step "Creating .env.local from template..."
        cat > .env.local << EOF
# 🎙️ Antislash Talk Environment Configuration
# Copy this file and add your actual values

# Supabase Configuration (Required)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Pre-configure API Keys
VITE_MISTRAL_API_KEY=your_mistral_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_GOOGLE_API_KEY=your_google_api_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key

# Production Settings
NODE_ENV=production
EOF
        print_success "Created .env.local template"
        echo -e "${YELLOW}⚠️  Please edit .env.local with your actual values${NC}"
    else
        print_success "Environment file exists"
    fi
}

run_tests() {
    print_step "Running tests..."
    
    if npm run test --silent; then
        print_success "All tests passed"
    else
        print_error "Tests failed"
        exit 1
    fi
}

show_help() {
    cat << EOF
🎙️ Antislash Talk Deployment Script

Usage: $0 [OPTION]

Options:
    netlify         Deploy to Netlify
    vercel          Deploy to Vercel
    docker          Build and run Docker container
    compose         Deploy with Docker Compose (full stack)
    build           Build project only
    test            Run tests
    setup           Setup environment files
    help            Show this help message

Examples:
    $0 netlify      # Deploy to Netlify
    $0 docker       # Deploy with Docker
    $0 compose      # Full stack with Docker Compose
    $0 build        # Build for production

For more information, visit: https://github.com/yourusername/Antislash Talk
EOF
}

# Main script
main() {
    print_header
    
    case "$1" in
        "netlify")
            check_dependencies
            setup_environment
            install_dependencies
            run_tests
            build_project
            deploy_netlify
            ;;
        "vercel")
            check_dependencies
            setup_environment
            install_dependencies
            run_tests
            build_project
            deploy_vercel
            ;;
        "docker")
            check_dependencies
            setup_environment
            deploy_docker
            ;;
        "compose")
            setup_environment
            deploy_docker_compose
            ;;
        "build")
            check_dependencies
            install_dependencies
            build_project
            ;;
        "test")
            check_dependencies
            install_dependencies
            run_tests
            ;;
        "setup")
            setup_environment
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        "")
            print_error "No deployment target specified"
            echo ""
            show_help
            exit 1
            ;;
        *)
            print_error "Unknown deployment target: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
    
    echo ""
    print_success "Deployment completed! 🎉"
}

# Run main function with all arguments
main "$@" 