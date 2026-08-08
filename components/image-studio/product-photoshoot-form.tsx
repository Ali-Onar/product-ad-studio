"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createProductPhotoshoot } from "@/app/dashboard/image/actions";
import { ImageDropzone, validateImageFile } from "@/components/image-studio/image-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildInputStoragePath, PHOTOSHOOT_DEFAULT_PARAMETERS, PHOTOSHOOT_FIELDS, photoshootParametersSchema } from "@/lib/generation/product-photoshoot";
import type { PhotoshootParameters } from "@/lib/generation/product-photoshoot";
import { GENERATIONS_BUCKET } from "@/lib/generation/storage";
import { createClient } from "@/lib/supabase/client";

function fileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  return file.type === "image/png" ? "png" : "jpg";
}

function creditLabel(amount: number) {
  return amount === 1 ? "credit" : "credits";
}

interface ProductPhotoshootFormProps {
  userId: string;
  creditBalance: number;
  creditCost: number;
}

export function ProductPhotoshootForm({ userId, creditBalance, creditCost }: ProductPhotoshootFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<PhotoshootParameters>({
    resolver: zodResolver(photoshootParametersSchema),
    defaultValues: PHOTOSHOOT_DEFAULT_PARAMETERS,
  });

  const hasEnoughCredits = creditBalance >= creditCost;

  const onSubmit = async (parameters: PhotoshootParameters) => {
    if (!file) {
      toast.error("Please select a product image first.");

      return;
    }

    const validationError = validateImageFile(file);

    if (validationError) {
      toast.error(validationError);

      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const generationId = crypto.randomUUID();
      const inputStoragePath = buildInputStoragePath(userId, generationId, fileExtension(file));

      const { error: uploadError } = await supabase.storage
        .from(GENERATIONS_BUCKET)
        .upload(inputStoragePath, file, { contentType: file.type || undefined });

      if (uploadError) {
        toast.error("We could not upload your image. Please try again.");

        return;
      }

      const result = await createProductPhotoshoot({
        ...parameters,
        generationId,
        inputStoragePath,
      });

      if (result.error) {
        // The generation never started, so don't leave the upload behind.
        await supabase.storage.from(GENERATIONS_BUCKET).remove([inputStoragePath]);
        toast.error(result.error);

        return;
      }

      toast.success("Generation started. We'll show the result as soon as it's ready.");
      form.reset(PHOTOSHOOT_DEFAULT_PARAMETERS);
      setFile(null);
      // Pulls the new row into the list below, which then polls it.
      router.refresh();
    } catch (error: unknown) {
      console.error("Failed to start product photoshoot:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New product photo</CardTitle>
        <CardDescription>
          Upload a product image and pick how it should be styled. Each run costs {creditCost}{" "}
          {creditLabel(creditCost)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <FormLabel>Product image</FormLabel>
              <ImageDropzone
                file={file}
                onFileChange={setFile}
                onError={(message) => toast.error(message)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {PHOTOSHOOT_FIELDS.map((parameter) => (
                <FormField
                  key={parameter.name}
                  control={form.control}
                  name={parameter.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{parameter.label}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parameter.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {parameter.description && <FormDescription>{parameter.description}</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {!hasEnoughCredits && (
              <p className="text-sm text-destructive">
                You need {creditCost} {creditLabel(creditCost)} to run a generation. Your balance is{" "}
                {creditBalance}.
              </p>
            )}

            <Button
              type="submit"
              className="w-full sm:w-auto sm:self-start"
              disabled={isSubmitting || !file || !hasEnoughCredits}
            >
              <SparklesIcon />
              {isSubmitting ? "Starting..." : "Generate"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
