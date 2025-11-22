"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  FormControl,
  Input,
  Label,
  MarkDownRenderer,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  TextArea,
  TextContent,
  ThemeProvider,
} from "@crayonai/react-ui";
import "@crayonai/react-ui/styles/index.css";

type FormField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "number";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
};

type FormDefinition = {
  component: "Form";
  props: {
    title: string;
    description?: string;
    submitLabel?: string;
    fields: FormField[];
  };
};

type C1ComponentDefinition = {
  component: {
    component: string;
    props: Record<string, any>;
  };
};

async function callFormApi(action: "generate_form" | "submit_query", payload?: any) {
  const res = await fetch("/api/s1-serp-form", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      action === "generate_form"
        ? { action }
        : { action, formData: payload }
    ),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return res.json();
}

export default function S1SerpCopilotPage() {
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formLoading, setFormLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [components, setComponents] = useState<C1ComponentDefinition[]>([]);

  useEffect(() => {
    async function fetchForm() {
      try {
        setFormLoading(true);
        const data = await callFormApi("generate_form");
        if (data?.component?.component === "Form") {
          setFormDefinition(data.component);
          const defaults: Record<string, any> = {};
          data.component.props?.fields?.forEach((field: FormField) => {
            if (field.defaultValue !== undefined) {
              defaults[field.name] = field.defaultValue;
            } else {
              defaults[field.name] = field.type === "number" ? 0 : "";
            }
          });
          setFormValues(defaults);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : err ? String(err) : "Failed to load form";
        setError(message);
      } finally {
        setFormLoading(false);
      }
    }
    fetchForm();
  }, []);

  const handleFieldChange = (name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const data = await callFormApi("submit_query", formValues);
      setComponents(data.components || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : err ? String(err) : "Request failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const renderField = (field: FormField) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      required: field.required,
      placeholder: field.placeholder,
      value: formValues[field.name] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleFieldChange(field.name, e.target.value),
    };

    let control: React.ReactNode;
    if (field.type === "textarea") {
      control = (
        <TextArea
          {...commonProps}
          rows={4}
        />
      );
    } else {
      control = (
        <Input
          {...commonProps}
          type={field.type}
          min={field.min}
          max={field.max}
        />
      );
    }

    return (
      <FormControl key={field.name} className="flex flex-col gap-2">
        <Label htmlFor={field.name} required={field.required}>
          {field.label}
        </Label>
        {control}
      </FormControl>
    );
  };

  const renderComponent = (component: C1ComponentDefinition, index: number) => {
    const { component: c } = component;
    if (c.component === "TextContent") {
      return (
        <Card key={`text-${index}`} variant="card" className="bg-[#0F111A] border border-[#1F2333]">
          <CardHeader
            title="Answer"
            subtitle="Generated explanation"
            className="mb-2"
          />
          <TextContent>
            <MarkDownRenderer textMarkdown={c.props.textMarkdown} />
          </TextContent>
        </Card>
      );
    }
    if (c.component === "Table") {
      const columns = c.props.columns || [];
      const rows = c.props.rows || [];
      return (
        <Card key={`table-${index}`} variant="card" className="bg-[#0F111A] border border-[#1F2333]">
          <CardHeader
            title="Context rows"
            subtitle={c.props.title?.replace("Context rows (", "").replace(")", "")}
          />
          <div className="overflow-x-auto text-sm">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  {columns.map((col: any) => (
                    <TableHead key={col.key} className="uppercase text-xs tracking-wide">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any, rowIdx: number) => (
                  <TableRow key={rowIdx}>
                    {columns.map((col: any) => (
                      <TableCell key={col.key} className="whitespace-nowrap">
                        {row[col.key] ?? "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      );
    }
    return null;
  };

  return (
    <ThemeProvider mode="dark">
      <div
        className="min-h-screen"
        style={{
          backgroundColor: "var(--crayon-background-fills)",
          color: "var(--crayon-primary-text)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
          <Card>
            <CardHeader
              title={formDefinition?.props.title ?? "Query parameters"}
              subtitle={formDefinition?.props.description}
            />
            {error && (
              <TextContent variant="card">
                <MarkDownRenderer textMarkdown={`**Error:** ${error}`} />
              </TextContent>
            )}
            {formLoading ? (
              <TextContent>
                <MarkDownRenderer textMarkdown="Loading form…" />
              </TextContent>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {formDefinition?.props.fields.map((field) => renderField(field))}
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Running…" : formDefinition?.props.submitLabel ?? "Submit"}
                </Button>
              </form>
            )}
          </Card>

          {components.length > 0 && (
            <div className="space-y-4">
              {components.map((component, idx) => renderComponent(component, idx))}
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}


