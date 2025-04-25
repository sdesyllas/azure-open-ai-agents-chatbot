# Azure OpenAI Agents Chatbot

An interactive web application that allows users to chat with different Azure OpenAI Agents through a modern interface built with Angular.

![github-ai-chatbox](https://github.com/user-attachments/assets/794356fc-a9e3-4526-b8db-bf7939282c65)

## Overview

This project demonstrates how to integrate Azure OpenAI Agents into a web application. It allows users to:
- Select from different AI agents configured in your Azure OpenAI project
- Start conversations with these agents
- Receive streaming responses in real-time
- Maintain conversation history for each agent
- View recommended questions based on agent context

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

Before running the application, update the configuration in `src/app/config/api-config.ts` with your Azure OpenAI settings:

```typescript
export const ApiConfig = {
  openai: {
    apiEndpoint: 'your openAI endpoint here',
    apiVersion: '2025-01-01-preview',
    apiKey: 'your openAI api key here'
  },
  aiProjects: {
    connectionString: "your azure project connection string here"
  }
};
```

Example of a properly formatted OpenAI endpoint:
```
https://your-resource-name.openai.azure.com/
```

Example of a properly formatted connection string:

```
projects.azure.com/YourProjectName;instance=your-region.instances.azure.ai;apikey=your-api-key
```

### Development server

To start a local development server, run:

```bash
npm start
```

Alternatively, you can use the Angular CLI directly:

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
- **Recommended Questions**: Displays suggested questions based on the selected agent
- **Chat Interface**: Modern, user-friendly chat interface with message history

## Architecture

The application consists of:

- **Frontend**: Angular application with Material UI components
  - **Components**:
    - Agent Selector: For choosing different AI agents
    - Chat Interface: For displaying and managing conversation
- **Backend**: Express server that mediates between the frontend and Azure OpenAI services
- **Azure Integration**: Connection to Azure OpenAI services via the AI Projects Client
- **Services**:
  - AI Project Service: Handles communication with Azure OpenAI
  - Recommended Questions Service: Manages suggested questions for agents

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
npm test
```

## Additional Resources

- [Azure OpenAI Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Angular Documentation](https://angular.dev/)
- [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
