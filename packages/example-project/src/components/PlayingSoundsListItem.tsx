import React, { useState } from 'react';
import { useInterval } from '../hooks/useInterval';
import { ProgressBar } from './ProgressBar';
import { PlayingSound } from '@mediamonks/channels';
import { VolumeControls } from './VolumeControls';

type Props = {
  playingSound: PlayingSound;
};

export const PlayingSoundsListItem = ({ playingSound }: Props) => {
  const [progress, setProgress] = useState(0);

  useInterval(() => {
    setProgress(playingSound.getProgress());
  }, 10);

  return (
    <div style={{ backgroundColor: 'lightblue' }}>
      <div className="block-padding">
        <p>
          <strong>{playingSound.sound.name}</strong>
          &nbsp;
          <small>(channel {playingSound.channel?.name || '---'})</small>
          <button onClick={() => playingSound.stop()}>stop</button>
        </p>
        <VolumeControls volumeNodes={playingSound.volumeNodes} />
      </div>
      <ProgressBar progress={progress} foregroundColor={'red'} height={5} />
    </div>
  );
};
