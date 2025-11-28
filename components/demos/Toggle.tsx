import { type VariantProps } from 'class-variance-authority';
import { MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { Container } from '@/components/docs/container';
import { Toggle, toggleVariants } from '@/components/livekit/toggle';

type toggleVariantsSizeType = VariantProps<typeof toggleVariants>['size'];
type toggleVariantsType = VariantProps<typeof toggleVariants>['variant'];

export default function ToggleDemo() {
  return (
    <Container componentName="Toggle">
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
          {['default', 'primary', 'secondary', 'outline'].map((variant) => (
            <tr key={variant}>
              <td className="text-right font-mono text-xs font-normal uppercase">{variant}</td>
              {['sm', 'default', 'lg', 'icon'].map((size) => (
                <td key={size}>
                  <Toggle
                    size={size as toggleVariantsSizeType}
                    variant={variant as toggleVariantsType}
                  >
                    {size === 'icon' ? <MicrophoneIcon size={16} weight="bold" /> : 'Toggle'}
                  </Toggle>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Container>
  );
}
