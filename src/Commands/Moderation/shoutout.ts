import { PrivateMessage } from '@twurple/chat/lib';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import { getUserApi } from '../../api/userApiClient';
import { getChatClient } from '../../chat';
import { Command } from '../../interfaces/apiInterfaces';
import { CommandUssageWebhookTOKEN, TwitchActivityWebhookID, TwitchActivityWebhookToken, commandUsageWebhookID, userID } from '../../util/constants';

const shoutout: Command = {
	name: 'shoutout',
	description: 'Shout out a user from the chat',
	usage: '!shoutout [@name]',
	execute: async (channel: string, user: string, args: string[], text: string, msg: PrivateMessage) => {
		const chatClient = await getChatClient();
		const userApiClient = await getUserApi();
		const commandUsage = new WebhookClient({ id: commandUsageWebhookID, token: CommandUssageWebhookTOKEN });
		const TwitchActivity = new WebhookClient({ id: TwitchActivityWebhookID, token: TwitchActivityWebhookToken });

		const broadcasterID = await userApiClient.channels.getChannelInfoById(userID);
		if (broadcasterID?.id === undefined) return;
		if (!args[0]) return chatClient.say(channel, `Usage: ${shoutout.usage}`);
		const userSearch = await userApiClient.users.getUserByName(args[0].replace('@', ''));
		if (userSearch?.id === undefined) return;
		const userInfo = await userApiClient.channels.getChannelInfoById(userSearch?.id);
		const stream = await userApiClient.streams.getStreamByUserName(broadcasterID.name);
		if (stream !== null) { userApiClient.chat.shoutoutUser(broadcasterID.id, userSearch?.id, broadcasterID.id); }

		await chatClient.say(channel, `Yay! Look who's here! @${userInfo?.displayName} just got mentioned! Let's all head over to their awesome Twitch channel at https://twitch.tv/${userInfo?.name.toLowerCase()} and show them some love! By the way, if you're wondering what game they were last playing, it was ${userInfo?.gameName}. So go check them out and join in on the fun!`);
		const commandUsageEmbed = new EmbedBuilder()
			.setTitle('CommandUsage[Shoutout]')
			.setAuthor({ name: `${userSearch.displayName}`, iconURL: `${userSearch.profilePictureUrl}` })
			.setColor('Yellow')
			.addFields([
				{
					name: 'Executer',
					value: `${msg.userInfo.displayName}`,
					inline: true
				},
				{
					name: 'Mod',
					value: `${msg.userInfo.isMod}`,
					inline: true
				},
				{
					name: 'broadcaster',
					value: `${msg.userInfo.isBroadcaster}`,
					inline: true
				}
			])
			.setThumbnail(userSearch.profilePictureUrl)
			.setURL(`https://twitch.tv/${userInfo?.name.toLowerCase()}`)
			.setFooter({ text: `${msg.userInfo.displayName} just shouted out ${userInfo?.displayName} in ${channel}'s twitch channel` })
			.setTimestamp();

		const shoutoutEmbed = new EmbedBuilder()
			.setTitle('Twitch Shoutout')
			.setAuthor({ name: `${userSearch.displayName}`, iconURL: `${userSearch.profilePictureUrl}` })
			.setColor('Green')
			.setThumbnail(userSearch.profilePictureUrl)
			.setURL(`https://twitch.tv/${userInfo?.name.toLowerCase()}`)
			.setFooter({ text: `${msg.userInfo.displayName} just shouted out ${userInfo?.displayName} in ${channel}'s twitch channel` })
			.setTimestamp();
		await commandUsage.send({ embeds: [commandUsageEmbed] });
		await TwitchActivity.send({ embeds: [shoutoutEmbed] });
	}
};
export default shoutout;