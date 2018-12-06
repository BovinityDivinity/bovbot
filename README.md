# BovBot

A simple Twitch chatbot developed for BinnieTV. Using it on other channels is possible, but some functions are unique to the BinnieTV channel at this time.

## Commands

!uptime - Returns the amount of time the current stream has been online. 

!join - Asks BovBot to join your channel. (Used only in BovBot channel)

!addcom [command] [response] - Adds a custom command to the database.

!editcom [command] [new response] - Changes the response of a custom command in the database.

!delcom [command] - Removes a custom command from the database.

!commands - Returns a link to a page containing all the custom commands for the current channel.

!topic [topic] - Changes the topic of the current stream.

!game [game] - Changes the game of the current stream. 

!promote [name] - Promotes a viewer to 'regular' status. (Currently has no effect)

!8ball [question] - Ask the Magic 8-Ball a question!

!currency - Returns the amount of currency user has.

!bet [amount] - Bets [amount] of currency, rolling against the minmum roll value set by the streamer. 

## External APIs

BovBot is not (yet) capable of accessing arbitrary APIs via user commands. However, there are some built-in commands that connect to external APIs. These commands can all be enabled or disabled via the control panel. 

!hs [card name] - Returns details (Cost, text, attack/defense) of a given Hearthstone card. Will return the nearest match if only a partial or incorrect name is given.

!skin [weapon name] | [skin name] [quality] - Returns the lowest and median prices of any given CS:GO skin currently on the steam marketplace. Will return undefined if no listings for that item are found, or an error if the given skin does not exist. ex: !skin AK-47 | Redline (FN)

!champion [name] [key] - Returns the abilities and passive of a given League of Legends character. If the optional key value is specified, will instead return the details of the character ability associated with that key. 

## Timers

Currently, BovBot supports the addition of timers that are executed on a given interval. Timers can be added, edited and deleted on the BovBot administration website. 

## Viewer Tracking

Every 15 minutes, BovBot currently takes a survey of all viewers in each channel that it is present in and awards "currency" to said viewers. Currently this tracking and currency can be viewed on the BovBot admin site and can be used by viewers to "bet" in chat. In the future currency will be used for determining which viewers are 'regulars', the threshold after which a viewer is allowed to post links, the ability to weight viewers entries into giveaways if desired, or the spending of currency for giveaways. 

## Spam Filter

If BovBot is a moderator in your channel, it will automatically timeout any viewer posting an unbroken chain of six or more ASCII characters (excluding typical punctuation). 

Currently this functionality cannot be disabled or customized on the control panel, which can render it a bit oppressive right now. Customization will come in a future update. 

## Variables

BovBot currently supports the usage of variables in custom commands. Custom variables take the form of $(1) and up to nine custom variables can be added per command, up to $(9). Commands with custom variables will return an error if an improper number of custom variables are passed when invoking the command.

In addition, BovBot supports the following built-in variables:

$(user) - Returns the name of the user invoking the command.

$(random) - Returns the name of a random viewer currently in the stream.

## Giveaways

Currently giveaway functionality is only supported on the BinnieTV stream. The giveaway system uses a separate page that allows the streamer to randomly select a winner using several different criteria. (Options include: Chat activity, all viewers, and currency amount)

The winning viewer will have their name displayed on-stream in a custom alert if the streamer has configured their streaming software to do so.

## Draw

Draw is a BovBot functionality that allows viewers to draw directly on the stream that they are viewing. Draw requires the broadcaster to have the CLR Browser plugin installed in OBS, and have a CLR Browser source with a width and height equal to their stream width and height. In addition, the CLR Browser source must be pointed at http://www.bovinitydivinity.com/draw/[channelName]/drawframe.html. 

Once these steps are followed, viewers can navigate to http://www.bovinitydivinity.com/draw.html?channel=[channelName] and will see the stream specified in the URL. Viewers can draw directly on this copy of the stream, and the results will appear live on the stream itself. 

## On the to-do list:

Link protection.

Phrase blacklists/spam filter/etc.

Usage for viewer currency.

Viewer games played via chat that appear on-stream.

## Control Panel

Web interface can be viewed at: http://www.bovinitydivinity.com (Requires Twitch login, and is a development server so may be down frequently.) 

Some other functions that have not yet been completed or polished will appear on the interface panel that may not be documented here.
