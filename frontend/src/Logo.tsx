import logoUrl from "../imgs/LogoNexora.svg";

export function Logo({ size = 40 }: { size?: number }) {
  return <img src={logoUrl} width={size} height={size} alt="Nexora" />;
}
