import { useSearchParams } from "react-router-dom";
import FormLoader from "../components/FormLoader";
import CreateForm from "../components/CreateForm";
export default function CreateSeriesPage() {
  const [params] = useSearchParams();
  const draft = params.get("draft");
  return (
    <div className="page max-w-[1400px]">
      {draft ? (
        <FormLoader path={`/drafts/${draft}`}>
          {(data) => <CreateForm initial={data.data} draftId={draft} />}
        </FormLoader>
      ) : (
        <CreateForm />
      )}
    </div>
  );
}
