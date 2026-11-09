import { useParams } from "react-router-dom";
import { useResource } from "../lib/useResource";
import { ResourceState } from "../components/Feedback";
import VersionContent from "../components/VersionContent";
export default function VersionDetailPage() {
  const { id } = useParams();
  const resource = useResource(`/versions/${id}`);
  return (
    <div className="page">
      <ResourceState resource={resource}>
        {resource.data && <VersionContent key={id} version={resource.data} />}
      </ResourceState>
    </div>
  );
}
