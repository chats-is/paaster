import { ErrorFolder } from "@/components/folder/error-folder";

export default function NotFound() {
  return (
    <ErrorFolder
      title="This content isn't available"
      detail="It doesn't exist, has expired, or was burned after reading."
    />
  );
}
