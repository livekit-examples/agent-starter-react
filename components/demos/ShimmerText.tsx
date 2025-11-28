import { Container } from '../docs/container';
import { ShimmerText } from '../livekit/shimmer-text';

export default function ShimmerTextDemo() {
  return (
    <Container componentName="ShimmerText">
      <div className="text-center">
        <ShimmerText>This is shimmer text</ShimmerText>
      </div>
    </Container>
  );
}
