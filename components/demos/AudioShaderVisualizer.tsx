import { useMemo, useState } from 'react';
import { type VariantProps } from 'class-variance-authority';
import { Track } from 'livekit-client';
import {
  type AgentState,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { useLocalParticipant } from '@livekit/components-react';
import { Container } from '@/components/docs/container';
import { StoryTitle } from '@/components/docs/story-title';
import {
  AudioShaderVisualizer,
  audioShaderVisualizerVariants,
} from '@/components/livekit/audio-visualizer/audio-shader-visualizer/audio-shader-visualizer';
import { Button } from '@/components/livekit/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import { useMicrophone } from '@/hooks/useMicrophone';
import { cn } from '@/lib/utils';

type audioShaderVisualizerVariantsSizeType = VariantProps<
  typeof audioShaderVisualizerVariants
>['size'];

export default function AudioShaderVisualizerDemo() {
  // shape
  const [shape, setShape] = useState(1.0);
  // color scale
  const [colorShift, setColorShift] = useState(0.3);

  const sizes = ['icon', 'sm', 'md', 'lg', 'xl'];
  const states = [
    'disconnected',
    'connecting',
    'initializing',
    'listening',
    'thinking',
    'speaking',
  ] as AgentState[];
  const colors: [number, number, number][] = [
    [31.0 / 255, 213.0 / 255, 249.0 / 255], // LiveKit Blue
    [0.0, 0.0, 1.0], // Blue
    [0.0, 1.0, 0.0], // Green
    [1.0, 0.0, 0.0], // Red
    [1.0, 0.0, 1.0], // Purple
  ];

  const [rgbColor, setRgbColor] = useState<[number, number, number]>(colors[0]);
  const [size, setSize] = useState<audioShaderVisualizerVariantsSizeType>('lg');
  const [state, setState] = useState<AgentState>(states[1]);

  const { microphoneTrack, localParticipant } = useLocalParticipant();
  const micTrackRef = useMemo<TrackReferenceOrPlaceholder | undefined>(() => {
    return state === 'speaking'
      ? ({
          participant: localParticipant,
          source: Track.Source.Microphone,
          publication: microphoneTrack,
        } as TrackReference)
      : undefined;
  }, [state, localParticipant, microphoneTrack]);

  useMicrophone();

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hexColor = e.target.value;

    try {
      const rgbColor = hexColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);

      if (rgbColor) {
        const [, r, g, b] = rgbColor;
        const color = [r, g, b].map((c) => parseInt(c, 16) / 255);

        setRgbColor(color as [number, number, number]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fields = [['color shift', colorShift, setColorShift, 0, 1, 0.01]] as const;

  return (
    <Container componentName="AudioShaderVisualizer">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="font-mono text-xs uppercase" htmlFor="size">
            Size
          </label>
          <Select
            value={size as string}
            onValueChange={(value) => setSize(value as audioShaderVisualizerVariantsSizeType)}
          >
            <SelectTrigger id="size" className="w-full">
              <SelectValue placeholder="Select a size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size} value={size as string}>
                  {size.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="font-mono text-xs uppercase" htmlFor="shape">
            Shape
          </label>
          <Select value={shape.toString()} onValueChange={(value) => setShape(parseInt(value))}>
            <SelectTrigger id="shape" className="w-full">
              <SelectValue placeholder="Select a shape" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Circle</SelectItem>
              <SelectItem value="2">Line</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="py-12">
        <AudioShaderVisualizer
          size={size}
          state={state}
          shape={shape}
          rgbColor={rgbColor}
          colorShift={colorShift}
          audioTrack={micTrackRef!}
          className="mx-auto"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        {states.map((stateType) => (
          <Button
            key={stateType}
            size="sm"
            variant={state === stateType ? 'primary' : 'default'}
            onClick={() => setState(stateType)}
            className={'flex-1'}
          >
            {stateType}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <StoryTitle>Color</StoryTitle>
          <div className="flex items-center gap-2">
            {colors.map((color) => (
              <div
                key={color.join(',')}
                onClick={() => setRgbColor(color)}
                style={{ backgroundColor: `rgb(${color.map((c) => c * 255).join(',')})` }}
                className={cn(
                  'h-4 w-4 cursor-pointer rounded-full',
                  rgbColor.toString() === color.toString() &&
                    'ring-muted-foreground ring-offset-background ring-1 ring-offset-2'
                )}
              />
            ))}

            <Button
              type="button"
              size="sm"
              className="relative"
              onClick={() => setRgbColor(colors[0])}
            >
              <span className="text-muted-foreground text-xs">Pick a color</span>
              <span
                className="inline-block size-4 rounded-full"
                style={{ backgroundColor: `rgb(${rgbColor.map((c) => c * 255).join(',')})` }}
              />
              <input
                type="color"
                onChange={handleColorChange}
                className="absolute inset-0 m-0 block h-full w-full opacity-0"
              />
            </Button>
          </div>
        </div>

        {fields.map(([name, value, setValue, min = 0.1, max = 10, step = 0.1]) => {
          return (
            <div key={name}>
              <div className="flex items-center justify-between">
                <StoryTitle>{name}</StoryTitle>
                <div className="text-muted-foreground mb-2 text-xs">{String(value)}</div>
              </div>
              <input
                type="range"
                value={String(value)}
                min={min}
                max={max}
                step={step}
                onChange={(e) => setValue(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          );
        })}
      </div>
    </Container>
  );
}
