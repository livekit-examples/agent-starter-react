import { Container } from '../docs/container';
import { StoryTitle } from '../docs/story-title';
import { AlertToast } from '../livekit/alert-toast';

export default function AlertToastDemo() {
  return (
    <Container componentName="AlertToast">
      <StoryTitle>Alert toast</StoryTitle>
      <div className="mx-auto max-w-prose">
        <AlertToast
          id="alert-toast"
          title="Alert toast"
          description="This is a alert toast description."
        />
      </div>
    </Container>
  );
}
