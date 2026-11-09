import { useParams } from "react-router-dom";
import { useResource } from "../lib/useResource";
import { ResourceState } from "../components/Feedback";
import SeriesContent from "../components/SeriesContent";
export default function SeriesDetailPage() {
  const { id } = useParams();
  const resource = useResource(`/series/${id}`);
  return (
    <div className="page">
      <ResourceState resource={resource}>
        {resource.data && <SeriesContent key={id} series={resource.data} />}
      </ResourceState>
    </div>
  );
}
