# Command Categories

This directory contains organized slash commands using discordx's `@Category` decorator from `@discordx/utilities` for better command organization.

## Structure

```plaintext
categories/
└── utility/        # Utility commands
    ├── info.ts     # User information
    └── ping.ts     # Bot latency check
```

## Adding New Commands

1. **Choose a category** (or create a new one)
2. **Create a new file** in the appropriate category folder
3. **Use the `@Category` decorator** to group commands:

```typescript
import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";
import { Category } from "@discordx/utilities";

@Discord()
@Category("CategoryName")
export class YourCommand {
  @Slash({ description: "Your command description" })
  async yourCommand(interaction: CommandInteraction): Promise<void> {
    // Your command logic here
  }
}
```

## Available Categories

- **utility**: General utility commands (ping, info, etc.)

## Discord Guidelines

- Category names can use proper capitalization (e.g., "Utility", "Admin")
- Use descriptive names that match the command's purpose
- Keep commands organized and well-documented
