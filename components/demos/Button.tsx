import { type VariantProps } from 'class-variance-authority';
import { MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { Container } from '@/components/docs/container';
import { Button, buttonVariants } from '@/components/livekit/button';

type buttonVariantsSizeType = VariantProps<typeof buttonVariants>['size'];
type buttonVariantsType = VariantProps<typeof buttonVariants>['variant'];

export default function ButtonDemo() {
  return (
    <Container componentName="Button">
      <table className="w-full">
        <thead className="font-mono text-xs font-normal uppercase [&_th]:w-1/5 [&_th]:p-2 [&_th]:text-center [&_th]:font-normal">
          <tr>
            <th></th>
            <th>Small</th>
            <th>Default</th>
            <th>Large</th>
            <th>Icon</th>
          </tr>
        </thead>
        <tbody className="[&_td]:p-2 [&_td:not(:first-child)]:text-center">
          {['default', 'primary', 'secondary', 'outline', 'ghost', 'link', 'destructive'].map(
            (variant) => (
              <tr key={variant}>
                <td className="text-right font-mono text-xs font-normal uppercase">{variant}</td>
                {['sm', 'default', 'lg', 'icon'].map((size) => (
                  <td key={size}>
                    <Button
                      variant={variant as buttonVariantsType}
                      size={size as buttonVariantsSizeType}
                    >
                      {size === 'icon' ? <MicrophoneIcon size={16} weight="bold" /> : 'Button'}
                    </Button>
                  </td>
                ))}
              </tr>
            )
          )}
        </tbody>
      </table>
    </Container>
  );
}
