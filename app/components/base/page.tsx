import { PlusIcon } from '@phosphor-icons/react/dist/ssr';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Container } from '../Container';

const buttonVariants = ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const;
const toggleVariants = ['default', 'outline'] as const;
const alertVariants = ['default', 'destructive'] as const;

export default function Base() {
  return (
    <>
      {/* Button */}
      <Container>
        <h3 className="text-muted-foreground text-sm">A button component.</h3>
        <div className="space-y-2">
          {buttonVariants.map((variant) => (
            <div key={variant}>
              <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">{variant}</h4>
              <div className="grid w-full grid-cols-4 gap-2">
                <div>
                  <Button variant={variant} size="sm">
                    Size sm
                  </Button>
                </div>
                <div>
                  <Button variant={variant}>Size default</Button>
                </div>
                <div>
                  <Button variant={variant} size="lg">
                    Size lg
                  </Button>
                </div>
                <div>
                  <Button variant={variant} size="icon">
                    <PlusIcon size={16} weight="bold" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>

      {/* Toggle */}
      <Container>
        <h3 className="text-muted-foreground text-sm">A toggle component.</h3>
        <div className="space-y-2">
          {toggleVariants.map((variant) => (
            <div key={variant}>
              <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">{variant}</h4>
              <div className="grid w-full grid-cols-3 gap-2">
                <div>
                  <Toggle key={variant} variant={variant} size="sm">
                    Size sm
                  </Toggle>
                </div>
                <div>
                  <Toggle key={variant} variant={variant}>
                    Size default
                  </Toggle>
                </div>
                <div>
                  <Toggle key={variant} variant={variant} size="lg">
                    Size lg
                  </Toggle>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>

      {/* Alert */}
      <Container>
        <h3 className="text-muted-foreground text-sm">An alert component.</h3>
        <div className="space-y-6">
          {alertVariants.map((variant) => (
            <div key={variant}>
              <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">{variant}</h4>
              <Alert key={variant} variant={variant}>
                <AlertTitle>Alert {variant} title</AlertTitle>
                <AlertDescription>This is a {variant} alert description.</AlertDescription>
              </Alert>
            </div>
          ))}
        </div>
      </Container>

      {/* Select */}
      <Container>
        <h3 className="text-muted-foreground text-sm">A select component.</h3>
        <div className="grid w-full grid-cols-2 gap-2">
          <div>
            <h4 className="text-muted-foreground mb-2 font-mono text-xs uppercase">Size default</h4>
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
            <h3 className="text-muted-foreground mb-2 font-mono text-xs uppercase">Size sm</h3>
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
    </>
  );
}
