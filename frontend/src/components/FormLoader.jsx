import { useResource } from "../lib/useResource";
import { ResourceState } from "./Feedback";
export default function FormLoader({ path, children }) {
  const resource = useResource(path);
  return (
    <ResourceState resource={resource}>{resource.data && children(resource.data)}</ResourceState>
  );
}
