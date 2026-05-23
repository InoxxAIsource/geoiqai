import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAddMonitoredBrand, getGetMonitoredBrandsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const addBrandSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  brandName: z.string().optional(),
});

interface AddBrandModalProps {
  onBrandAdded?: (brandId: string, domain: string) => void;
}

export function AddBrandModal({ onBrandAdded }: AddBrandModalProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addBrandMutation = useAddMonitoredBrand();

  const form = useForm<z.infer<typeof addBrandSchema>>({
    resolver: zodResolver(addBrandSchema),
    defaultValues: {
      domain: "",
      brandName: "",
    }
  });

  const onSubmit = (values: z.infer<typeof addBrandSchema>) => {
    addBrandMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        if (onBrandAdded && data?.id) {
          onBrandAdded(data.id, values.domain);
        }
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to add brand. Please check your plan limits.", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm">
          <Plus className="w-4 h-4" /> Add Brand
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Monitor a new brand</DialogTitle>
          <DialogDescription>
            Add a domain to start tracking its AI visibility. We will run a full audit right away.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <FormControl>
                    <Input placeholder="startup.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Startup Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addBrandMutation.isPending}>
                {addBrandMutation.isPending ? "Adding..." : "Add Brand"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
