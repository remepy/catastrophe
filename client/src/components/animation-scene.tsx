import step0 from "@/assets/images/step-0.webp";
import step1 from "@/assets/images/step-1.webp";
import step2 from "@/assets/images/step-2.webp";
import step3 from "@/assets/images/step-3.webp";
import step4 from "@/assets/images/step-4.webp";
import step5 from "@/assets/images/step-5.webp";
import step6 from "@/assets/images/step-6.webp";
import step7 from "@/assets/images/step-7.webp";

interface AnimationSceneProps {
  wrongGuesses: number;
}

// Imported so the build emits them as content-hashed files under assets/.
const STEP_IMAGES = [step0, step1, step2, step3, step4, step5, step6, step7];

export function AnimationScene({ wrongGuesses }: AnimationSceneProps) {
  const currentStep = Math.min(wrongGuesses, STEP_IMAGES.length - 1);

  return (
    <div
      className="relative w-full overflow-hidden rounded-md"
      style={{ aspectRatio: "16/5" }}
      data-testid="animation-scene"
      aria-hidden="true"
    >
      {STEP_IMAGES.map((src, index) => (
        <img
          key={index}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ease-in-out"
          style={{ opacity: index === currentStep ? 1 : 0 }}
          data-testid={index === currentStep ? "img-current-step" : undefined}
        />
      ))}
    </div>
  );
}
