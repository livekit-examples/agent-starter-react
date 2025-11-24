import { type VariantProps } from 'class-variance-authority';
import { Container } from '@/components/docs/container';
import { StoryTitle } from '@/components/docs/story-title';
import { Alert, AlertDescription, AlertTitle, alertVariants } from '@/components/livekit/alert';

type alertVariantsType = VariantProps<typeof alertVariants>['variant'];

export default function AlertDemo() {
  return (
    <Container componentName="Alert">
      {['default', 'destructive'].map((variant) => (
        <div key={variant}>
          <StoryTitle>{variant}</StoryTitle>
          <Alert key={variant} variant={variant as alertVariantsType}>
            <AlertTitle>Alert {variant} title</AlertTitle>
            <AlertDescription>This is a {variant} alert description.</AlertDescription>
          </Alert>
        </div>
      ))}
    </Container>
  );
}
