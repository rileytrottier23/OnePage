import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailIcon, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/use-auth";

export default function ContactPage() {
  const { user } = useAuth();
  const homeLink = user ? "/dashboard" : "/";
  
  return (
    <div className="container mx-auto px-4 sm:px-6 max-w-3xl min-h-screen">
      <div className="py-6 sticky top-0 bg-background z-10">
        <Header />
      </div>
      
      <main className="flex flex-col items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Contact Us</CardTitle>
            <CardDescription>
              Need help with OnePage or have a question?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <MailIcon className="mx-auto h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-medium">For any questions, reach out to:</p>
              <a 
                href="mailto:riley.a.trottier@gmail.com"
                className="text-primary hover:underline inline-block mt-2"
              >
                riley.a.trottier@gmail.com
              </a>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Common queries:</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="font-medium">Forgot password?</span> - Please reach out via email with your username and registered email address.
                </li>
                <li>
                  <span className="font-medium">Account issues?</span> - Contact us with details about any login or account problems you're experiencing.
                </li>
                <li>
                  <span className="font-medium">Feature requests?</span> - We'd love to hear your ideas for improving OnePage.
                </li>
              </ul>
            </div>

            <div className="pt-4">
              <Link href={homeLink}>
                <Button className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to OnePage
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}