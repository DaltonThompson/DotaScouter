## dota-scouter
Automatically scout players' most successful heroes.

# What is Dota 2?
Dota 2 is a “multiplayer online battle arena (MOBA)” game in which two teams of five players each choose a “hero” from a pool of 121, each with unique strengths. The game is highly strategic. The beginning phase, in which heroes are picked and banned, sets the stage for what will happen over approximately 45 minutes, although game lengths can vary greatly.
# What is the origin of the Scouter?
This tool is inspired by others which have come before it, with Dotapicker being the first and greatest influence. In a previous web browser version, the user was required to manually input identification numbers for all ten players, as well as the hero picks and bans as they happened. DotaPlus for Overwolf is well-known for its capabilities to detect hero picks by observing the user’s screen (OCR). A potentially Mac-friendly project called Dotabuddy seems to have issues such as deprecated dependencies. A few lines of code are derived from it.
# When should I use the Scouter?
The Scouter is currently best in impromptu “public matchmaking” games. This is because it quickly shows an overview of each player when the user is under time pressure, providing no context (at least in this stage of development). For a planned game, teams generally have time prior to the match in which they can do a more thorough analysis of themselves and their opponents. Importantly, the Scouter supplements the user. It is not intended to replace one's own judgment.
# Is this cheating?
Officially, no. This is not detected as a cheat, because it does not change game files. Similar products have existed for years (namely DotaPlus for Overwolf). Some players may consider the advantage unfair, but the player-specific game data which drives the Scouter is anonymous by default, and is only available voluntarily.
# What happens if the Scouter cannot retrieve data for a player?
Scouter uses population data to generalize how well a random player can be expected to play as, or respond to, a hero.
# What is the population?
The population is a random selection of games in the last thirty days, provided by OpenDota.
# How does the Scouter weigh personal and population data when sorting heroes?
A player must play four games as a hero within the search period to weigh equally with population data.
# Why not be more specific when calling for a player’s data?
It is hard making predictions from the entire small sample available per player, given factors such as game mode, hero, other players present, heros banned, ally or enemy heroes picked, etc.
# What are plans for the future?
I plan to clean up code and add several features to bring it up to par with similar apps, especially dynamic pick suggestions based upon the synergy and advantage between heroes, and roles for each player. Both features could work well by using an OCR to automate the selection heroes.

# Notes
* This program relies upon many API calls, and is subject to the status of third parties. It is recommended to not refresh unless it seems non-functional.
* This program is currently intended to function only when an on-going match is detected. It may sometimes continue to operate if the game has not cleared all of the data from the lines which ar being read.
* For those who wish to alter the source code, refer to `renderer.js` when seeking to change to test mode. `playersTotalInGame` may be reduced to reduce API calls while testing, and `server_log` may be changed to a new filepath.
