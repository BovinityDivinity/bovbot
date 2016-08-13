# BovBot

A simple Twitch chatbot developed for BinnieTV as a Node practice project. Could be decent for public use eventually, but mostly just a development exercize for now.

## Commands

!uptime - Returns the amount of time the current stream has been online. 

!join - Asks BovBot to join your channel. (Used only in BovBot channel)

!addcom [command] [response] - Adds a custom command to the database.

!editcom [command] [new response] - Changes the response of a custom command in the database.

!delcom [command] - Removes a custom command from the database.

!commands - Returns a link to a page containing all the custom commands for the current channel.

!topic - Changes the topic of the current stream.

!game - Changes the game of the current stream. 

!promote [name] - Promotes a viewer to 'regular' status. (Currently has no effect)

## Timers

Currently, BovBot supports the addition of timers that are executed on a given interval. Timers can be added, edited and deleted on the BovBov administration website. 

## Viewer Tracking

Every 15 minutes, BovBot currently takes a survey of all viewers in each channel that it is present in and awards "currency" to said viewers. Currently this tracking and currency has no usage beyond the list of viewers (which can be viewed on the BovBot admin site) but in the future will be used for determining which viewers are 'regulars', the threshold after which a viewer is allowed to post links, the ability to weight viewers entries into giveaways if desired, or the spending of currency for giveaways. 

## Variables

BovBot currently supports the usage of variables in custom commands. Custom variables take the form of $(1) and up to nine custom variables can be added per command, up to $(9). Commands with custom variables will return an error if an improper number of custom variables are passed when invoking the command.

In addition, BovBot supports the following built-in variables:

$(user) - Returns the name of the user invoking the command.

$(random) - Returns the name of a random viewer currently in the stream.

## Draw

Draw is a BovBot functionality that allows viewers to draw directly on the stream that they are viewing. Draw requires the broadcaster to have the CLR Browser plugin installed in OBS, and have a CLR Browser source with a width and height equal to their stream width and height. In addition, the CLR Browser source must be pointed at http://www.bovinitydivinity.com/drawframe.html. 

Once these steps are followed, viewers can navigate to http://www.bovinitydivinity.com/draw.html?channel=[channelName] and will see the stream specified in the URL. Viewers can draw directly on this copy of the stream, and the results will appear live on the stream itself. 

## On the to-do list:

Adding easier customization of timers.

Link protection.

Phrase blacklists/spam filter/etc.

Usage for viewer currency.

Viewer games played via chat that appear on-stream.

## Control Panel

Web interface can be viewed at: http://www.bovinitydivinity.com (Requires Twitch login, and is a development server so may be down frequently.)
