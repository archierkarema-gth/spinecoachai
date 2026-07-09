"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  newAssessmentInputSchema,
  hasRedFlag,
  type NewAssessmentInput,
} from "@/lib/schemas";
import { putAssessment } from "@/lib/db";
import { useAppStore } from "@/lib/store";

const RED_FLAG_FIELDS = [
  { key: "neurologicalSymptoms", label: "Kesemutan, mati rasa, atau lemah otot" },
  { key: "bowelBladderChanges", label: "Perubahan kontrol BAB/BAK" },
  { key: "severeWorseningPain", label: "Nyeri berat yang makin memburuk" },
  { key: "trauma", label: "Baru mengalami cedera/trauma" },
  { key: "feverWithSevereBackPain", label: "Demam disertai nyeri punggung berat" },
] as const;

export default function AssessmentPage() {
  const router = useRouter();
  const { user, hydrate, hydrated, setLatestAssessment } = useAppStore();
  const [escalate, setEscalate] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewAssessmentInput>({
    resolver: zodResolver(newAssessmentInputSchema),
    defaultValues: {
      userId: user?.id ?? "",
      diagnosedByPhysician: false,
      painLevel: 0,
      activityLevel: "light",
      availableMinutesPerDay: 20,
      redFlags: {
        neurologicalSymptoms: false,
        bowelBladderChanges: false,
        severeWorseningPain: false,
        trauma: false,
        feverWithSevereBackPain: false,
      },
    },
  });

  async function onSubmit(values: NewAssessmentInput) {
    if (!user) return;

    if (hasRedFlag(values.redFlags)) {
      setEscalate(true);
      return;
    }

    const assessment = {
      ...values,
      userId: user.id,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await putAssessment(assessment);
    setLatestAssessment(assessment);
    router.push("/");
  }

  if (escalate) {
    return (
      <div className="px-5 pt-6">
        <Card className="border-destructive bg-destructive/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-destructive" size={20} />
            <div>
              <p className="font-semibold text-foreground">
                Sebaiknya periksa ke dokter dulu
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gejala yang kamu tandai perlu dicek tenaga medis sebelum
                lanjut latihan. SpineCoach AI tidak mendiagnosis atau
                menggantikan dokter — ini bukan keadaan darurat, tapi jangan
                ditunda.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setEscalate(false)}
              >
                Kembali ke form
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title="Asesmen awal"
        subtitle="Info ini dipakai buat menyusun latihan yang aman — bukan diagnosis."
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5 px-5 pb-8"
      >
        <Card className="flex flex-col gap-4">
          <div>
            <Label htmlFor="diagnosedByPhysician">
              <input
                id="diagnosedByPhysician"
                type="checkbox"
                className="mr-2 h-4 w-4 align-middle"
                {...register("diagnosedByPhysician")}
              />
              Sudah pernah didiagnosis scoliosis oleh dokter
            </Label>
          </div>

          <div>
            <Label htmlFor="curveLocationSelfReported">
              Lokasi kurva (kata dokter, opsional)
            </Label>
            <Input
              id="curveLocationSelfReported"
              placeholder="mis. thoracic kanan"
              {...register("curveLocationSelfReported")}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <Label htmlFor="painLevel">Level nyeri saat ini (0–10)</Label>
            <Input
              id="painLevel"
              type="number"
              min={0}
              max={10}
              {...register("painLevel", { valueAsNumber: true })}
            />
            {errors.painLevel && (
              <p className="mt-1 text-xs text-destructive">
                {errors.painLevel.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="painAreas">Area yang nyeri</Label>
            <Input
              id="painAreas"
              placeholder="mis. punggung bawah, bahu kanan"
              {...register("painAreas")}
            />
          </div>

          <div>
            <Label htmlFor="mobilityLimitations">Keterbatasan gerak</Label>
            <Textarea
              id="mobilityLimitations"
              placeholder="Gerakan apa yang terasa sulit atau dihindari?"
              {...register("mobilityLimitations")}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <Label htmlFor="activityLevel">Level aktivitas saat ini</Label>
            <select
              id="activityLevel"
              className="h-11 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm"
              {...register("activityLevel")}
            >
              <option value="sedentary">Jarang bergerak</option>
              <option value="light">Ringan</option>
              <option value="moderate">Sedang</option>
              <option value="active">Aktif</option>
            </select>
          </div>

          <div>
            <Label htmlFor="availableMinutesPerDay">
              Waktu latihan tersedia per hari (menit)
            </Label>
            <Input
              id="availableMinutesPerDay"
              type="number"
              min={5}
              max={180}
              {...register("availableMinutesPerDay", { valueAsNumber: true })}
            />
          </div>

          <div>
            <Label htmlFor="primaryGoals">Tujuan utama</Label>
            <Textarea
              id="primaryGoals"
              placeholder="mis. kurangi nyeri, postur lebih tegak, tambah kekuatan"
              {...register("primaryGoals")}
            />
            {errors.primaryGoals && (
              <p className="mt-1 text-xs text-destructive">
                {errors.primaryGoals.message}
              </p>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">
            Ada salah satu dari ini?
          </p>
          {RED_FLAG_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                {...register(`redFlags.${key}`)}
              />
              {label}
            </label>
          ))}
        </Card>

        <Button type="submit" size="lg" disabled={isSubmitting || !user}>
          {isSubmitting ? "Menyimpan…" : "Simpan asesmen"}
        </Button>
      </form>
    </div>
  );
}
