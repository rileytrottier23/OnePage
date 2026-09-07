# OnePage Task Management

A sleek, minimalist task management application built with React, Express, and modern web technologies.

## Features

- **Single Page Interface**: All tasks and categories visible on one screen
- **Today Section**: Quick access to important tasks
- **Category Organization**: Group tasks by customizable categories
- **Task Hierarchy**: Create subtasks with indentation (using Tab key)
- **Multi-line Paste**: Create multiple tasks at once by pasting multi-line text
- **Drag & Drop**: Easily reorganize tasks between categories
- **Keyboard Navigation**: Tab to indent, Shift+Tab to unindent
- **Dark Theme**: Easy on the eyes for extended use

## Technical Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI components
- **Backend**: Express.js, TypeScript
- **State Management**: TanStack Query
- **Drag & Drop**: dnd-kit
- **Styling**: Tailwind CSS with custom theming

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set `DATABASE_URL` to a Postgres connection string (e.g. in a `.env` file)
4. Start the development server: `npm run dev`
5. Open http://localhost:5000 in your browser

## Deployment

Hosted on [Railway](https://railway.com), deployed automatically from `main`. `railway.json` defines the build (`npm run build`) and start (`npm run start`) commands; the app reads `PORT` and `DATABASE_URL` from the environment. GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, build, and tests on every push and pull request.

## Usage Tips

- **Creating Tasks**: Type in the input box at the bottom of each section
- **Creating Multiple Tasks**: Paste multi-line text to create multiple tasks at once
- **Indenting Tasks**: Click on a task and press Tab
- **Unindenting Tasks**: Press Shift+Tab
- **Moving Tasks**: Drag and drop, or use the arrow icons
- **Editing Categories**: Hover over a category name and click the pencil icon
- **Archiving Completed Tasks**: Click the "Archive Completed" button

## License

MIT