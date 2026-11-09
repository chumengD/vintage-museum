import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthProvider from "./components/AuthProvider";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
const HomePage = lazy(() => import("./pages/HomePage"));
const SeriesListPage = lazy(() => import("./pages/SeriesListPage"));
const SeriesDetailPage = lazy(() => import("./pages/SeriesDetailPage"));
const VersionDetailPage = lazy(() => import("./pages/VersionDetailPage"));
const PublishVersionPage = lazy(() => import("./pages/PublishVersionPage"));
const CreateSeriesPage = lazy(() => import("./pages/CreateSeriesPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const DraftsPage = lazy(() => import("./pages/DraftsPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ContributorPage = lazy(() => import("./pages/ContributorPage"));
const protectedPage = (page) => <RequireAuth>{page}</RequireAuth>;
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <p role="status" className="page">
              正在翻阅馆藏…
            </p>
          }
        >
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="series" element={<SeriesListPage />} />
              <Route path="series/new" element={protectedPage(<CreateSeriesPage />)} />
              <Route path="series/:id" element={<SeriesDetailPage />} />
              <Route path="versions/:id" element={<VersionDetailPage />} />
              <Route path="versions/:id/edit" element={protectedPage(<PublishVersionPage />)} />
              <Route path="publish" element={protectedPage(<PublishVersionPage />)} />
              <Route path="favorites" element={protectedPage(<FavoritesPage />)} />
              <Route path="profile" element={protectedPage(<ProfilePage />)} />
              <Route path="drafts" element={protectedPage(<DraftsPage />)} />
              <Route path="contributors/:id" element={<ContributorPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
