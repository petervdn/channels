import { CreateSound, OptionalChannel } from './types';
import { AudioContext } from './util/audioContext';
import SampleManager from 'sample-manager';
import { VolumeNodes } from './VolumeNodes';
import { CreateChannelOptions, Channel } from './Channel';
import { PlayingSound, PlaySoundOptions } from './PlayingSound';
import EventDispatcher from 'seng-event';
import { ChannelsEvent } from './event/ChannelsEvent';

type ConstructorProps = {
  soundsPath: string;
  soundsExtension: string;
  audioContext?: AudioContext;
  sounds?: Array<CreateSound>;
};

export class Channels extends EventDispatcher {
  public readonly audioContext: AudioContext;
  private readonly channelsByName: Record<string, Channel> = {};
  private readonly playingSounds: Array<PlayingSound> = [];
  public readonly sampleManager: SampleManager;
  public readonly volumeNodes: VolumeNodes;

  constructor({
    audioContext,
    soundsExtension,
    soundsPath,
    sounds,
  }: ConstructorProps) {
    super();
    this.audioContext = audioContext || new AudioContext();

    if (!this.audioContext) {
      throw new Error('Failed to create an AudioContext');
    }

    this.sampleManager = new SampleManager(
      this.audioContext,
      soundsPath,
      soundsExtension
    );

    if (sounds) {
      this.sampleManager.addSamples(sounds);
    }

    // everything connect to the main volume controls
    this.volumeNodes = new VolumeNodes(this.audioContext);
    this.volumeNodes.output.connect(this.audioContext.destination);
  }

  /**
   * Resumes the audioContext if it's in the suspended state.
   */
  public resumeContext = () => {
    return this.contextIsSuspended
      ? this.audioContext.resume()
      : Promise.resolve();
  };

  public get contextIsSuspended() {
    return this.audioContext.state === 'suspended';
  }

  /**
   * Loads all samples. (alias for sampleManager.loadAllSamples)
   * @param onProgress
   */
  public loadAllSounds = (onProgress?: (value: number) => void) => {
    return this.sampleManager.loadAllSamples(onProgress);
  };

  /**
   * Gets a list of all sounds. (alias for sampleManager.getAllSamples)
   */
  public getSounds = () => {
    return [...this.sampleManager.getAllSamples()];
  };

  public getPlayingSounds = () => {
    return [...this.playingSounds];
  };

  /**
   * Creates a new channel.
   * @param name
   * @param createChannelOptions
   */
  public createChannel = (
    name: string,
    createChannelOptions: CreateChannelOptions = {}
  ): Channel => {
    if (name === '') {
      throw new Error('Channel name cannot be blank');
    }
    if (this.channelsByName[name]) {
      throw new Error(`Channel with name '${name}' already exists`);
    }

    const channel = new Channel(name, this, createChannelOptions);

    this.channelsByName[name] = channel;

    this.dispatchEvent(new ChannelsEvent(ChannelsEvent.types.CHANNELS_UPDATED));

    return channel;
  };

  /**
   * Gets a list of all available channels.
   */
  public getChannels = (): Array<Channel> => {
    return Object.keys(this.channelsByName).map(
      channelName => this.channelsByName[channelName]
    );
  };

  /**
   * Removes a PlayingSound from the list.
   * @param playingSound
   * @private
   */
  public removePlayingSound = (playingSound: PlayingSound) => {
    const index = this.playingSounds.indexOf(playingSound);
    if (index > -1) {
      this.playingSounds.splice(index, 1);
      this.dispatchEvent(
        new ChannelsEvent(ChannelsEvent.types.PLAYING_SOUNDS_UPDATED)
      );
    } else {
      throw new Error(
        `Trying to remove a playing sound that is not listed: ${playingSound.sound.name}`
      );
    }
  };

  /**
   * Utility function to handle often used optional channel parameters,
   * which can be either the channel's name or a channel instance
   * @param channel
   * @private
   */
  private getOptionalChannelByNameOrInstance = (
    channel: OptionalChannel['channel']
  ): Channel | undefined => {
    if (typeof channel === 'string' && !this.channelsByName[channel]) {
      throw new Error(`Channel '${channel}' does not exist`);
    }
    return typeof channel === 'string' ? this.channelsByName[channel] : channel;
  };

  /**
   * Stop either all sounds or, when a channel name is supplied, all
   * sounds that are playing on a channel.
   * @param channelName
   */
  public stopAll = ({ channel }: OptionalChannel = {}) => {
    const channelToStop = this.getOptionalChannelByNameOrInstance(channel);

    this.playingSounds
      .filter(({ channel }) =>
        channelToStop ? channel === channelToStop : true
      )
      .forEach(playingSound => playingSound.stop());
  };

  /**
   * Get a channel by its name.
   * @param channelName
   */
  public getChannel = (channelName: string) => {
    const channel = this.channelsByName[channelName];

    if (!channel) {
      throw new Error(`Channel '${channelName}' does not exist`);
    }

    return channel;
  };

  /**
   * Gets the VolumeNodes instance for a channel or, when no channelName
   * is supplied, the one for the main output.
   * @param channel
   * @private
   */
  private getVolumeNodes = ({ channel }: OptionalChannel = {}): VolumeNodes => {
    const optionalChannel = this.getOptionalChannelByNameOrInstance(channel);

    return optionalChannel?.volumeNodes || this.volumeNodes;
  };

  public getVolume = ({ channel }: OptionalChannel = {}) => {
    return this.getVolumeNodes({ channel }).volume;
  };

  /**
   * Sets the volume for either a channel or the main output.
   * @param value
   * @param options
   */
  public setVolume = (value: number, { channel }: OptionalChannel = {}) => {
    this.getVolumeNodes({ channel }).volume = value;
  };

  /**
   * Mutes either a channel or the main output.
   * @param value
   * @param options
   */
  public setMute = (value: boolean, { channel }: OptionalChannel = {}) => {
    if (value) {
      this.getVolumeNodes({ channel }).mute();
    } else {
      this.getVolumeNodes({ channel }).unmute();
    }
  };

  /**
   * Play a sound. When no channel is supplied, it will be played directly
   * on the main output.
   * @param name
   * @param channel
   * @param playSoundOptions
   */
  public play = (
    name: string,
    { channel, ...playSoundOptions }: PlaySoundOptions & OptionalChannel = {}
  ): PlayingSound => {
    const sound = this.sampleManager.getSampleByName(name);
    if (!sound) {
      throw new Error(`Cannot find sound: '${name}`);
    }
    const channelForSound = this.getOptionalChannelByNameOrInstance(channel);

    const playingSound = new PlayingSound(
      this,
      sound,
      (channelForSound?.volumeNodes || this.volumeNodes).input,
      channelForSound,
      playSoundOptions
    );

    if (channelForSound?.type === 'monophonic') {
      this.stopAll({ channel });
    }

    this.playingSounds.push(playingSound);

    this.dispatchEvent(
      new ChannelsEvent(ChannelsEvent.types.PLAYING_SOUNDS_UPDATED)
    );

    return playingSound;
  };
}
