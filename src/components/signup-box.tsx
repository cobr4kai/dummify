import { signupAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type SignupStatus = "success" | "invalid" | "error" | null;

const signupMessages: Record<Exclude<SignupStatus, null>, string> = {
  success: "You're on the list. We'll send the next update your way.",
  invalid: "Enter a valid email address to join the list.",
  error: "Something went wrong while saving your signup. Please try again.",
};

export function SignupBox({
  status,
  className,
  layout = "stacked",
}: {
  status: SignupStatus;
  className?: string;
  layout?: "stacked" | "horizontal";
}) {
  const isHorizontal = layout === "horizontal";

  return (
    <section
      className={cn(
        "panel-soft rounded-[28px] px-5 py-5 shadow-[var(--shadow-card)] sm:px-6",
        isHorizontal && "px-6 py-6 sm:px-7",
        className,
      )}
    >
      <div className={cn(isHorizontal && "lg:flex lg:items-center lg:justify-between lg:gap-8")}>
        <div className={cn(isHorizontal ? "max-w-2xl" : undefined)}>
          <p className="eyebrow text-[11px] font-medium text-muted-foreground">
            Stay in the loop
          </p>
          <h2 className="editorial-title mt-2 text-[1.7rem] leading-none text-foreground sm:text-[1.9rem]">
            Join the Abstracted list
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Get a simple heads-up when new weekly briefs or launch updates go live.
          </p>
        </div>

        <form
          action={signupAction}
          className={cn(
            "mt-4 space-y-3",
            isHorizontal && "lg:mt-0 lg:w-full lg:max-w-[34rem] lg:space-y-0",
          )}
        >
          <div className={cn(isHorizontal && "lg:flex lg:items-end lg:gap-3")}>
            <label className="block space-y-2 text-sm font-medium text-foreground lg:flex-1">
              Email
              <Input
                autoComplete="email"
                name="email"
                placeholder="you@company.com"
                required
                type="email"
              />
            </label>
            <Button
              className={cn("w-full sm:w-auto", isHorizontal && "lg:mb-px lg:shrink-0")}
              size="lg"
              type="submit"
            >
              Join the list
            </Button>
          </div>
        </form>
      </div>

      {status ? (
        <p
          className={cn(
            "mt-3 text-sm leading-6",
            status === "success" ? "text-foreground" : "text-danger",
          )}
        >
          {signupMessages[status]}
        </p>
      ) : null}
    </section>
  );
}
