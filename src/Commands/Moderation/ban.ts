import { UserIdResolvable, UserNameResolvable } from '@twurple/api';
import { ChatMessage } from '@twurple/chat/lib';
import { getUserApi } from '../../api/userApiClient';
import { getChatClient } from '../../chat';
import { Command } from '../../interfaces/Command';
import { CommandUssageWebhookTOKEN, commandUsageWebhookID } from '../../util/constants';
import { EmbedBuilder, WebhookClient } from 'discord.js';

const ban: Command = {
	name: 'ban',
	description: 'Ban a user from your Twitch chat',
	usage: '!ban [@name] (reason)',
	execute: async (channel: string, user: string, args: string[], text: string, msg: ChatMessage) => {
		const chatClient = await getChatClient();
		const userApiClient = await getUserApi();
		const display = msg.userInfo.displayName;
		const commandUsage = new WebhookClient({ id: commandUsageWebhookID, token: CommandUssageWebhookTOKEN });

		try {
			if (!args[0]) {
				chatClient.say(channel, `${display}, Usage: ${ban.usage}`);
				return;
			}

			const reason = args.slice(1).join(' ') || 'No Reason Provided';
			const username = args[0].replace('@', '');
			const userSearch = await userApiClient.users.getUserByName(username);

			if (!userSearch?.id) {
				return chatClient.say(channel, `${display}, User not found.`);
			}

			// Check if the user is a mod or broadcaster
			if (!msg.userInfo.isMod && !msg.userInfo.isBroadcaster) {
				return chatClient.say(channel, `${display}, You don't have permission to use this command.`);
			}

			// Retrieve broadcaster information
			const broadcaster = await userApiClient.users.getUserByName(channel as UserNameResolvable);
			if (!broadcaster) {
				return chatClient.say(channel, `Could not find broadcaster information for channel: ${channel}`);
			}

			// Ban the user
			await userApiClient.moderation.banUser(broadcaster.id as UserIdResolvable, {
				user: userSearch.id,
				reason
			});

			// Send chat message about the ban
			await chatClient.say(channel, `@${username} has been banned for Reason: ${reason}`);

			const commandUsageEmbed = new EmbedBuilder()
				.setTitle('CommandUsage[Ban]')
				.setAuthor({ name: msg.userInfo.displayName, iconURL: userSearch.profilePictureUrl })
				.setDescription(reason)
				.setColor('Red')
				.addFields([
					{ name: 'Executer', value: msg.userInfo.displayName, inline: true },
					...(msg.userInfo.isMod
						? [{ name: 'Mod', value: 'Yes', inline: true }]
						: msg.userInfo.isBroadcaster
							? [{ name: 'Broadcaster', value: 'Yes', inline: true }]
							: []
					)
				])
				.setFooter({ text: `${msg.userInfo.displayName} just banned ${userSearch.displayName} in ${channel}'s twitch channel` })
				.setTimestamp();

			// Send the embed
			await commandUsage.send({ embeds: [commandUsageEmbed] });

		} catch (error) {
			console.error('Error executing ban command:', error);
		}
	}
};
export default ban;