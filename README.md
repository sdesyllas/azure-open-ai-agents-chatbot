# Azure OpenAI Agents Chatbot

An interactive web application that allows users to chat with different Azure OpenAI Agents through a modern interface built with Angular.

![github-ai-chatbox](https://github.com/user-attachments/assets/794356fc-a9e3-4526-b8db-bf7939282c65)

## Overview

This project demonstrates how to integrate Azure OpenAI Agents into a web application. It allows users to:
- Select from different AI agents configured in your Azure OpenAI project
- Start conversations with these agents
- Receive streaming responses in real-time
- Maintain conversation history for each agent

## About Azure OpenAI Agents

Azure OpenAI Agents are specialized AI assistants that can be configured to serve specific purposes. They're powered by Azure's advanced language models and can be enhanced with:

- Custom knowledge bases
- Third-party API integrations
- Specialized tools and capabilities
- Different personality traits and response styles

This project uses the `@azure/ai-projects` SDK to connect to your Azure OpenAI project and interact with your configured agents. It leverages server-sent events (SSE) for streaming responses in real-time.

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- Angular CLI
- An Azure subscription with access to Azure OpenAI services
- An Azure AI Project with configured agents

### Configuration

Before running the application, update the connection string in `src/server/config.ts` with your Azure OpenAI project connection string:

```typescript
export const config = {
    aiProjects: {
        connectionString: "your Azure OpenAI project connection string here"
    }
};
```

### Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Features

- **Agent Selection**: Choose from different AI agents configured in your Azure OpenAI project
- **Real-time Streaming**: Responses are streamed in real-time using Server-Sent Events
- **Thread Management**: Conversations are maintained in threads for context preservation
- **Markdown Support**: Agent responses support markdown formatting
- **Responsive Design**: Works on both desktop and mobile devices

## Architecture

The application consists of:

- **Frontend**: Angular application with Material UI components
- **Backend**: Express server that mediates between the frontend and Azure OpenAI services
- **Azure Integration**: Connection to Azure OpenAI services via the AI Projects Client

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Additional Resources

- [Azure OpenAI Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Angular Documentation](https://angular.dev/)
- [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
