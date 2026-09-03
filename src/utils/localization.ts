export const locales = {
  nl: {
    // Bot responses
    bot: {
      ready: 'Bot is klaar en online!',
      shutdown: 'Bot wordt afgesloten...',
      error: 'Er is een fout opgetreden',
      permission: 'Je hebt niet de juiste rechten om dit commando te gebruiken. (Permissie(s): {permission})',
      status: {
        nightmt: 'NightMT',
        madeby: 'Made by Vapor',
        invite: 'discord.gg/opminetopia',
      },
    },

    // Commands
    commands: {
      sendmessage: {
        description: 'Verstuur een bericht naar een kanaal.',
        channel: 'Het kanaal waarin het bericht moet worden verstuurd.',
        message: 'Het bericht dat moet worden verstuurd.',
        success: 'Bericht is verstuurd naar {channel}.',
      },
      ban: {
        description: 'Ban een lid van de server.',
        member: 'Het lid om te bannen.',
        reason: 'De reden voor de ban.',
        success: 'Gebruiker {user} is verbannen van de server.',
        userMessage: 'Je bent verbannen van {guild} door {moderator}.',
        noReason: 'Geen reden opgegeven',
      },
      kick: {
        description: 'Kick een lid van de server.',
        member: 'Het lid om te kicken.',
        reason: 'De reden voor de kick.',
        success: 'Gebruiker {user} is gekickt van de server.',
        userMessage: 'Je bent gekickt van {guild} door {moderator}.',
        noReason: 'Geen reden opgegeven',
      },
      timeout: {
        description: 'Geef een lid een timeout.',
        member: 'Het lid om een timeout te geven.',
        duration: 'De duur van de timeout (bijv. 1h, 30m, 1d).',
        reason: 'De reden voor de timeout.',
        success: 'Gebruiker {user} heeft een timeout van {duration} gekregen.',
        removed: 'Timeout voor {user} is succesvol verwijderd.',
        userMessage: 'Je hebt een timeout van {duration} gekregen in {guild} door {moderator}.',
        noReason: 'Geen reden opgegeven',
      },
      warn: {
        description: 'Waarschuw een lid.',
        member: 'Het lid om te waarschuwen.',
        reason: 'De reden voor de waarschuwing.',
        success: 'Gebruiker {user} is gewaarschuwd.',
        userMessage: 'Je bent gewaarschuwd door {moderator} in {guild}.',
        noReason: 'Geen reden opgegeven',
      },
      help: {
        description: "Toon alle beschikbare commando's.",
        title: "NightMT Bot Commando's",
        category: 'Categorie',
        usage: 'Gebruik',
      },
      info: {
        description: 'Toon informatie over de bot.',
        title: 'Bot Informatie',
        version: 'Versie',
        uptime: 'Uptime',
        serverCount: 'Aantal servers',
      },
      ping: {
        description: 'Test de bot latency.',
        response: 'Pong! Latency: {latency}ms',
      },
      profile: {
        description: 'Toon het profiel van een gebruiker.',
        user: 'De gebruiker om informatie over te tonen.',
        title: 'Profiel van {username}',
        joined: 'Lid sinds',
        roles: 'Rollen',
        infractions: 'Overtredingen',
        action: 'Wat wil je doen met je profiel',
      },
      setup: {
        description: 'Stel de bot in voor deze server.',
        title: 'Admin Setup Center',
        alreadySetup: 'Deze server is al ingesteld.',
        success: 'De bot is ingesteld voor deze server.',
        ticketChannelTitle: 'Ticket Channel',
        ticketChannelDescription: 'Kies een kanaal voor de ticket systemen',
        ticketChannelPlaceholder: 'Kies een kanaal voor de ticket systemen',
        ticketButtonLabel: 'Ticket System',
        automodButtonLabel: 'Automod System',
        ticketCategoryTitle: 'Ticket Category',
        ticketCategoryDescription: 'Kies een categorie voor de ticket systemen',
        ticketCategoryPlaceholder: 'Kies een categorie voor de ticket systemen',
      },
      fetchData: {
        description: 'Haal alle data op uit de SheetDB API.',
        success: 'Fetched {count} rows of data',
      },
      language: {
        description: 'Verander je taalvoorkeur.',
        language: 'De taal om naar te veranderen.',
        success: 'Je taal is veranderd naar {language}.',
        current: 'Je huidige taal is {language}.',
        available: 'Beschikbare talen',
      },
    },

    // Categories
    categories: {
      admin: 'Administratie',
      moderation: 'Moderatie',
      utility: 'Hulpmiddelen',
    },

    // Errors
    errors: {
      userNotFound: 'Gebruiker niet gevonden.',
      invalidDuration: 'Ongeldige duur opgegeven.',
      alreadyBanned: 'Deze gebruiker is al verbannen.',
      alreadyKicked: 'Deze gebruiker is al gekickt.',
      alreadyTimedOut: 'Deze gebruiker heeft al een timeout.',
      cannotBanSelf: 'Je kunt jezelf niet verbannen.',
      cannotKickSelf: 'Je kunt jezelf niet kicken.',
      cannotTimeoutSelf: 'Je kunt jezelf geen timeout geven.',
      botMissingPermission: 'Ik heb niet de juiste rechten om deze actie uit te voeren.',
    },
  },
  en: {
    // Bot responses
    bot: {
      ready: 'Bot is ready and online!',
      shutdown: 'Bot is shutting down...',
      error: 'An error has occurred',
      permission: 'You do not have the correct permissions to use this command. (Permission(s): {permission})',
      status: {
        nightmt: 'NightMT',
        madeby: 'Made by Vapor',
        invite: 'discord.gg/opminetopia',
      },
    },

    // Commands
    commands: {
      sendmessage: {
        description: 'Send a message to a channel.',
        channel: 'The channel where the message should be sent.',
        message: 'The message to be sent.',
        success: 'Message sent to {channel}.',
      },
      ban: {
        description: 'Ban a member from the server.',
        member: 'The member to ban.',
        reason: 'The reason for the ban.',
        success: 'User {user} has been banned from the server.',
        userMessage: 'You have been banned from {guild} by {moderator}.',
        noReason: 'No reason provided',
      },
      kick: {
        description: 'Kick a member from the server.',
        member: 'The member to kick.',
        reason: 'The reason for the kick.',
        success: 'User {user} has been kicked from the server.',
        userMessage: 'You have been kicked from {guild} by {moderator}.',
        noReason: 'No reason provided',
      },
      timeout: {
        description: 'Give a member a timeout.',
        member: 'The member to give a timeout to.',
        duration: 'The duration of the timeout (e.g. 1h, 30m, 1d).',
        reason: 'The reason for the timeout.',
        success: 'User {user} has been timed out for {duration}.',
        removed: 'Timeout for {user} has been successfully removed.',
        userMessage: 'You have been timed out for {duration} in {guild} by {moderator}.',
        noReason: 'No reason provided',
      },
      warn: {
        description: 'Warn a member.',
        member: 'The member to warn.',
        reason: 'The reason for the warning.',
        success: 'User {user} has been warned.',
        userMessage: 'You have been warned by {moderator} in {guild}.',
        noReason: 'No reason provided',
      },
      help: {
        description: 'Show all available commands.',
        title: 'NightMT Bot Commands',
        category: 'Category',
        usage: 'Usage',
      },
      info: {
        description: 'Show information about the bot.',
        title: 'Bot Information',
        version: 'Version',
        uptime: 'Uptime',
        serverCount: 'Server Count',
      },
      ping: {
        description: 'Test the bot latency.',
        response: 'Pong! Latency: {latency}ms',
      },
      profile: {
        description: 'Show a user\'s profile.',
        user: 'The user to show information about.',
        title: 'Profile of {username}',
        joined: 'Member since',
        roles: 'Roles',
        infractions: 'Infractions',
        action: 'What do you want to do with your profile',
      },
      setup: {
        description: 'Set up the bot for this server.',
        title: 'Admin Setup Center',
        alreadySetup: 'This server is already set up.',
        success: 'The bot has been set up for this server.',
        ticketChannelTitle: 'Ticket Channel',
        ticketChannelDescription: 'Choose a channel for the ticket systems',
        ticketChannelPlaceholder: 'Choose a channel for the ticket systems',
        ticketButtonLabel: 'Ticket System',
        automodButtonLabel: 'Automod System',
        ticketCategoryTitle: 'Ticket Category',
        ticketCategoryDescription: 'Choose a category for the ticket systems',
        ticketCategoryPlaceholder: 'Choose a category for the ticket systems',
      },
      fetchData: {
        description: 'Fetch all data from the SheetDB API.',
        success: 'Fetched {count} rows of data',
      },
      language: {
        description: 'Change your language preference.',
        language: 'The language to change to.',
        success: 'Your language has been changed to {language}.',
        current: 'Your current language is {language}.',
        available: 'Available languages',
      },
    },

    // Categories
    categories: {
      admin: 'Administration',
      moderation: 'Moderation',
      utility: 'Utilities',
    },

    // Errors
    errors: {
      userNotFound: 'User not found.',
      invalidDuration: 'Invalid duration provided.',
      alreadyBanned: 'This user is already banned.',
      alreadyKicked: 'This user is already kicked.',
      alreadyTimedOut: 'This user already has a timeout.',
      cannotBanSelf: 'You cannot ban yourself.',
      cannotKickSelf: 'You cannot kick yourself.',
      cannotTimeoutSelf: 'You cannot timeout yourself.',
      botMissingPermission: 'I do not have the correct permissions to perform this action.',
    },
  },
  es: {
    // Bot responses
    bot: {
      ready: '¡Bot está listo y en línea!',
      shutdown: 'Bot se está cerrando...',
      error: 'Ha ocurrido un error',
      permission: 'No tienes los permisos correctos para usar este comando. (Permiso(s): {permission})',
      status: {
        nightmt: 'NightMT',
        madeby: 'Made by Vapor',
        invite: 'discord.gg/opminetopia',
      },
    },

    // Commands
    commands: {
      sendmessage: {
        description: 'Enviar un mensaje a un canal.',
        channel: 'El canal donde se debe enviar el mensaje.',
        message: 'El mensaje a enviar.',
        success: 'Mensaje enviado a {channel}.',
      },
      ban: {
        description: 'Expulsar a un miembro del servidor.',
        member: 'El miembro a expulsar.',
        reason: 'La razón de la expulsión.',
        success: 'El usuario {user} ha sido expulsado del servidor.',
        userMessage: 'Has sido expulsado de {guild} por {moderator}.',
        noReason: 'Sin razón proporcionada',
      },
      kick: {
        description: 'Expulsar temporalmente a un miembro del servidor.',
        member: 'El miembro a expulsar.',
        reason: 'La razón de la expulsión.',
        success: 'El usuario {user} ha sido expulsado del servidor.',
        userMessage: 'Has sido expulsado de {guild} por {moderator}.',
        noReason: 'Sin razón proporcionada',
      },
      timeout: {
        description: 'Dar un timeout a un miembro.',
        member: 'El miembro al que dar timeout.',
        duration: 'La duración del timeout (ej. 1h, 30m, 1d).',
        reason: 'La razón del timeout.',
        success: 'El usuario {user} ha recibido un timeout de {duration}.',
        removed: 'El timeout para {user} ha sido removido exitosamente.',
        userMessage: 'Has recibido un timeout de {duration} en {guild} por {moderator}.',
        noReason: 'Sin razón proporcionada',
      },
      warn: {
        description: 'Advertir a un miembro.',
        member: 'El miembro a advertir.',
        reason: 'La razón de la advertencia.',
        success: 'El usuario {user} ha sido advertido.',
        userMessage: 'Has sido advertido por {moderator} en {guild}.',
        noReason: 'Sin razón proporcionada',
      },
      help: {
        description: 'Mostrar todos los comandos disponibles.',
        title: 'Comandos del Bot NightMT',
        category: 'Categoría',
        usage: 'Uso',
      },
      info: {
        description: 'Mostrar información sobre el bot.',
        title: 'Información del Bot',
        version: 'Versión',
        uptime: 'Tiempo activo',
        serverCount: 'Número de servidores',
      },
      ping: {
        description: 'Probar la latencia del bot.',
        response: '¡Pong! Latencia: {latency}ms',
      },
      profile: {
        description: 'Mostrar el perfil de un usuario.',
        user: 'El usuario del que mostrar información.',
        title: 'Perfil de {username}',
        joined: 'Miembro desde',
        roles: 'Roles',
        infractions: 'Infracciones',
        action: 'Qué quieres hacer con tu perfil',
      },
      setup: {
        description: 'Configurar el bot para este servidor.',
        title: 'Centro de Configuración Admin',
        alreadySetup: 'Este servidor ya está configurado.',
        success: 'El bot ha sido configurado para este servidor.',
        ticketChannelTitle: 'Canal de Tickets',
        ticketChannelDescription: 'Elige un canal para los sistemas de tickets',
        ticketChannelPlaceholder: 'Elige un canal para los sistemas de tickets',
        ticketButtonLabel: 'Sistema de Tickets',
        automodButtonLabel: 'Sistema de Automod',
        ticketCategoryTitle: 'Categoría de Tickets',
        ticketCategoryDescription: 'Elige una categoría para los sistemas de tickets',
        ticketCategoryPlaceholder: 'Elige una categoría para los sistemas de tickets',
      },
      fetchData: {
        description: 'Obtener todos los datos de la API de SheetDB.',
        success: 'Obtenidos {count} filas de datos',
      },
      language: {
        description: 'Cambiar tu preferencia de idioma.',
        language: 'El idioma al que cambiar.',
        success: 'Tu idioma ha sido cambiado a {language}.',
        current: 'Tu idioma actual es {language}.',
        available: 'Idiomas disponibles',
      },
    },

    // Categories
    categories: {
      admin: 'Administración',
      moderation: 'Moderación',
      utility: 'Utilidades',
    },

    // Errors
    errors: {
      userNotFound: 'Usuario no encontrado.',
      invalidDuration: 'Duración inválida proporcionada.',
      alreadyBanned: 'Este usuario ya está expulsado.',
      alreadyKicked: 'Este usuario ya fue expulsado.',
      alreadyTimedOut: 'Este usuario ya tiene un timeout.',
      cannotBanSelf: 'No puedes expulsarte a ti mismo.',
      cannotKickSelf: 'No puedes expulsarte a ti mismo.',
      cannotTimeoutSelf: 'No puedes darte timeout a ti mismo.',
      botMissingPermission: 'No tengo los permisos correctos para realizar esta acción.',
    },
  },
};

export type Locale = keyof typeof locales;
export type LocaleKey = keyof typeof locales.nl;

export function t(key: string, locale: Locale = 'nl', params?: Record<string, string>): string {
  const keys = key.split('.');
  let value: unknown = locales[locale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  if (typeof value === 'string' && params) {
    return value.replace(/\{(\w+)\}/g, (match, param) => params[param] || match);
  }

  return (value as string) || key;
}

/**
 * Get translation with user's language preference from database
 * This function should be used in commands where we have access to the user
 */
export async function tWithUser(
  key: string, 
  userId: string, 
  params?: Record<string, string>
): Promise<string> {
  try {
    const { getUserByDiscordId } = await import('./userManager');
    const user = await getUserByDiscordId(userId);
    const userLocale = (user?.language as Locale) || 'nl';
    return t(key, userLocale, params);
  } catch (error) {
    console.error('Error getting user language:', error);
    return t(key, 'nl', params); // Fallback to Dutch
  }
}

export function getLocale(): Locale {
  return 'nl'; // Default to Dutch
}

/**
 * Get available language options for autocomplete
 */
export function getAvailableLanguages(): Array<{ name: string; value: string }> {
  return [
    { name: '🇳🇱 Nederlands (Dutch)', value: 'nl' },
    { name: '🇺🇸 English', value: 'en' },
    { name: '🇪🇸 Español (Spanish)', value: 'es' },
  ];
}

/**
 * Get language name by code
 */
export function getLanguageName(code: string): string {
  const languages = getAvailableLanguages();
  const language = languages.find(lang => lang.value === code);
  return language ? language.name : code;
}
