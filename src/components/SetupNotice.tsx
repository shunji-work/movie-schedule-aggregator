import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SetupNoticeProps = {
  title?: string;
};

export function SetupNotice({
  title = 'Supabase environment variables are missing.',
}: SetupNoticeProps) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-amber-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-amber-900">
        <p>
          Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a local `.env`
          file to load live data.
        </p>
        <p>
          The app shell is rendering correctly, but data-driven pages stay in
          setup mode until those values are configured.
        </p>
      </CardContent>
    </Card>
  );
}
