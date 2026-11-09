import { useParams, useSearchParams } from "react-router-dom";
import FormLoader from "../components/FormLoader";
import VersionForm from "../components/VersionForm";
export default function PublishVersionPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const draft = params.get("draft");
  return (
    <div className="page">
      {id ? (
        <FormLoader path={`/versions/${id}`}>
          {(data) => <VersionForm initial={data} editId={id} />}
        </FormLoader>
      ) : draft ? (
        <FormLoader path={`/drafts/${draft}`}>
          {(data) => <VersionForm initial={data.data} draftId={draft} editId={data.data.editId} />}
        </FormLoader>
      ) : (
        <VersionForm initial={{ seriesId: params.get("series") || "" }} />
      )}
    </div>
  );
}
