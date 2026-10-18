import { ErrorDesk } from "@/components/desk/error-desk";

export default function NotFound() {
  return (
    <ErrorDesk
      title="This content isn't available"
      detail="It doesn't exist, has expired, or was burned after reading."
      status={404}
    />
  );
}
