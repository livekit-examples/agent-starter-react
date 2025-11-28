import { Container } from '@/components/docs/container';
import { StoryTitle } from '@/components/docs/story-title';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';

export default function SelectDemo() {
  return (
    <Container componentName="Select">
      <div className="grid w-full grid-cols-2 gap-2">
        <div>
          <StoryTitle>Size default</StoryTitle>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select a track" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Track 1</SelectItem>
              <SelectItem value="2">Track 2</SelectItem>
              <SelectItem value="3">Track 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <StoryTitle>Size sm</StoryTitle>
          <Select>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Select a track" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Track 1</SelectItem>
              <SelectItem value="2">Track 2</SelectItem>
              <SelectItem value="3">Track 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Container>
  );
}
