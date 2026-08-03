import { defineCommand } from "citty";
import { getOutputFormat, printOutput } from "../../lib/output.ts";
import {
  WebSettingsClient,
  WebSettingsError,
  control,
  controls,
  findHtmlForm,
  formBody,
  loadWebSettingsClient,
  replaceFormField,
  type HtmlForm,
  type SettingsPage,
} from "../../lib/web-settings.ts";

type AccessPolicy = "restricted" | "unrestricted";
type RequestPolicy = "auto" | "manual";
type LifetimePolicy = "none" | number;

interface PolicyValue<T> {
  value: T;
  writable: boolean;
  source: "organization" | "inherited";
}

export interface PatPolicyState {
  page: SettingsPage;
  forms: {
    access: HtmlForm;
    requests: HtmlForm;
    lifetime: HtmlForm;
  };
  policies: {
    access: PolicyValue<AccessPolicy>;
    requests: PolicyValue<RequestPolicy>;
    maximumLifetime: PolicyValue<LifetimePolicy> & {
      expirationRequirementWritable: boolean;
      allowedValues: string[];
      customConstraints?: { min: number; max: number; step: number };
    };
  };
}

interface RequestedPolicy {
  access?: AccessPolicy;
  requests?: RequestPolicy;
  maximumLifetime?: LifetimePolicy;
}

function policyPath(org: string): string {
  return `/organizations/${org}/settings/personal-access-tokens`;
}

function selectedRadio(form: HtmlForm, name: string): string {
  const selected = controls(form, name).find(
    (candidate) => candidate.type === "radio" && candidate.checked,
  );
  if (!selected) {
    throw new WebSettingsError(
      "form_schema_changed",
      `No selected value was found for ${name}.`,
    );
  }
  return selected.value;
}

function radioWritable(form: HtmlForm, name: string): boolean {
  const radios = controls(form, name).filter((candidate) => candidate.type === "radio");
  return radios.length > 0 && radios.some((candidate) => !candidate.disabled);
}

function parseAccess(form: HtmlForm): PolicyValue<AccessPolicy> {
  const value = selectedRadio(form, "organization[restrict_access]");
  if (value !== "enable" && value !== "disable") {
    throw new WebSettingsError(
      "form_schema_changed",
      `Unknown organization[restrict_access] value: ${value}`,
    );
  }
  const writable = radioWritable(form, "organization[restrict_access]");
  return {
    value: value === "enable" ? "restricted" : "unrestricted",
    writable,
    source: writable ? "organization" : "inherited",
  };
}

function parseRequests(form: HtmlForm): PolicyValue<RequestPolicy> {
  const value = selectedRadio(form, "organization[auto_approve]");
  if (value !== "enable" && value !== "disable") {
    throw new WebSettingsError(
      "form_schema_changed",
      `Unknown organization[auto_approve] value: ${value}`,
    );
  }
  const writable = radioWritable(form, "organization[auto_approve]");
  return {
    value: value === "enable" ? "auto" : "manual",
    writable,
    source: writable ? "organization" : "inherited",
  };
}

function numericAttribute(
  value: string | undefined,
  name: string,
  defaultValue?: number,
): number {
  if (!value && defaultValue !== undefined) return defaultValue;
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed)) {
    throw new WebSettingsError(
      "form_schema_changed",
      `The custom PAT lifetime input has no valid ${name} constraint.`,
    );
  }
  return parsed;
}

function parseLifetime(form: HtmlForm): PatPolicyState["policies"]["maximumLifetime"] {
  const checkbox = control(
    form,
    "organization[require_pat_to_expire]",
    "checkbox",
  );
  const select = control(
    form,
    "organization[fine_grained_personal_access_token_expiration_limit]",
    "select",
  );
  const custom = control(
    form,
    "organization[custom_fine_grained_personal_access_token_expiration_limit]",
    "number",
  );
  if (!checkbox || !select || !custom || !select.options) {
    throw new WebSettingsError(
      "form_schema_changed",
      "The fine-grained PAT lifetime form is incomplete.",
    );
  }
  const allowedValues = select.options.filter((option) => !option.disabled).map((option) => option.value);
  let value: LifetimePolicy = "none";
  if (checkbox.checked) {
    if (select.value === "custom") {
      const customValue = Number(custom.value);
      if (!Number.isInteger(customValue) || customValue <= 0) {
        throw new WebSettingsError(
          "form_schema_changed",
          "The selected custom PAT lifetime is not a positive integer.",
        );
      }
      value = customValue;
    } else {
      const selected = Number(select.value);
      if (!Number.isInteger(selected) || selected <= 0) {
        throw new WebSettingsError(
          "form_schema_changed",
          `Unknown PAT lifetime selection: ${select.value}`,
        );
      }
      value = selected;
    }
  }
  let customConstraints: { min: number; max: number; step: number } | undefined;
  if (allowedValues.includes("custom")) {
    customConstraints = {
      min: numericAttribute(custom.attributes.min, "min"),
      max: numericAttribute(custom.attributes.max, "max"),
      step: numericAttribute(custom.attributes.step, "step", 1),
    };
  }
  const writable = !select.disabled && !custom.disabled;
  return {
    value,
    writable,
    source: checkbox.disabled ? "inherited" : "organization",
    expirationRequirementWritable: !checkbox.disabled,
    allowedValues,
    customConstraints,
  };
}

export function parsePatPolicyPage(page: SettingsPage, org: string): PatPolicyState {
  const access = findHtmlForm(page, {
    action: `${policyPath(org)}/restrict-access`,
    method: "PATCH",
    requiredFields: ["authenticity_token", "organization[restrict_access]"],
    expectedWritableFields: ["organization[restrict_access]"],
  });
  const requests = findHtmlForm(page, {
    action: `/organizations/${org}/settings/personal-access-token-requests/auto-approve`,
    method: "PATCH",
    requiredFields: ["authenticity_token", "organization[auto_approve]"],
    expectedWritableFields: ["organization[auto_approve]"],
  });
  const lifetime = findHtmlForm(page, {
    action: `${policyPath(org)}/maximum-lifetime`,
    method: "PATCH",
    requiredFields: [
      "authenticity_token",
      "organization[pat_type]",
      "organization[require_pat_to_expire]",
      "organization[fine_grained_personal_access_token_expiration_limit]",
      "organization[custom_fine_grained_personal_access_token_expiration_limit]",
    ],
    expectedWritableFields: [
      "organization[require_pat_to_expire]",
      "organization[fine_grained_personal_access_token_expiration_limit]",
      "organization[custom_fine_grained_personal_access_token_expiration_limit]",
    ],
  });
  return {
    page,
    forms: { access, requests, lifetime },
    policies: {
      access: parseAccess(access),
      requests: parseRequests(requests),
      maximumLifetime: parseLifetime(lifetime),
    },
  };
}

async function readPatPolicy(client: WebSettingsClient, org: string): Promise<PatPolicyState> {
  const page = await client.get(`https://github.com${policyPath(org)}`);
  return parsePatPolicyPage(page, org);
}

function parseLifetimeArgument(value: string | undefined): LifetimePolicy | undefined {
  if (value === undefined) return undefined;
  if (value === "none") return "none";
  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    throw new Error("--max-lifetime must be none or a positive number of days.");
  }
  return Number(value);
}

function requestedFromArgs(args: Record<string, unknown>): RequestedPolicy {
  const access = args.access === undefined ? undefined : String(args.access);
  const requests = args.requests === undefined ? undefined : String(args.requests);
  if (access !== undefined && access !== "restricted" && access !== "unrestricted") {
    throw new Error("--access must be restricted or unrestricted.");
  }
  if (requests !== undefined && requests !== "auto" && requests !== "manual") {
    throw new Error("--requests must be auto or manual.");
  }
  return {
    access,
    requests,
    maximumLifetime: parseLifetimeArgument(
      args["max-lifetime"] === undefined ? undefined : String(args["max-lifetime"]),
    ),
  };
}

function policyChanges(state: PatPolicyState, requested: RequestedPolicy) {
  const changes: { field: string; current: string | number; desired: string | number }[] = [];
  if (requested.access !== undefined && requested.access !== state.policies.access.value) {
    changes.push({ field: "access", current: state.policies.access.value, desired: requested.access });
  }
  if (requested.requests !== undefined && requested.requests !== state.policies.requests.value) {
    changes.push({ field: "requests", current: state.policies.requests.value, desired: requested.requests });
  }
  if (
    requested.maximumLifetime !== undefined &&
    requested.maximumLifetime !== state.policies.maximumLifetime.value
  ) {
    changes.push({
      field: "maximumLifetime",
      current: state.policies.maximumLifetime.value,
      desired: requested.maximumLifetime,
    });
  }
  return changes;
}

function assertWritable(state: PatPolicyState, requested: RequestedPolicy): void {
  if (
    requested.access !== undefined &&
    requested.access !== state.policies.access.value &&
    !state.policies.access.writable
  ) {
    throw new WebSettingsError(
      "capability_unavailable",
      "The organization PAT access policy is inherited and cannot be changed here.",
      state.page.url,
    );
  }
  if (
    requested.requests !== undefined &&
    requested.requests !== state.policies.requests.value &&
    !state.policies.requests.writable
  ) {
    throw new WebSettingsError(
      "capability_unavailable",
      "The organization PAT request policy is inherited and cannot be changed here.",
      state.page.url,
    );
  }
  const desired = requested.maximumLifetime;
  if (desired === undefined || desired === state.policies.maximumLifetime.value) return;
  if (!state.policies.maximumLifetime.writable) {
    throw new WebSettingsError(
      "capability_unavailable",
      "The organization PAT maximum lifetime is inherited and cannot be changed here.",
      state.page.url,
    );
  }
  if (desired === "none" && !state.policies.maximumLifetime.expirationRequirementWritable) {
    throw new WebSettingsError(
      "capability_unavailable",
      "The expiration requirement is inherited and cannot be disabled at the organization level.",
      state.page.url,
    );
  }
  if (typeof desired === "number") {
    const preset = String(desired);
    if (state.policies.maximumLifetime.allowedValues.includes(preset)) return;
    if (!state.policies.maximumLifetime.allowedValues.includes("custom")) {
      throw new WebSettingsError(
        "form_schema_changed",
        `The live form does not allow a custom PAT lifetime of ${desired} days.`,
        state.page.url,
      );
    }
    const constraints = state.policies.maximumLifetime.customConstraints!;
    if (
      desired < constraints.min ||
      desired > constraints.max ||
      (desired - constraints.min) % constraints.step !== 0
    ) {
      throw new Error(
        `--max-lifetime ${desired} is outside the live constraints: min=${constraints.min}, max=${constraints.max}, step=${constraints.step}.`,
      );
    }
  }
}

function accessBody(form: HtmlForm, value: AccessPolicy): URLSearchParams {
  const body = formBody(form);
  replaceFormField(body, "organization[restrict_access]", value === "restricted" ? "enable" : "disable");
  includeCommit(form, body);
  return body;
}

function requestsBody(form: HtmlForm, value: RequestPolicy): URLSearchParams {
  const body = formBody(form);
  replaceFormField(body, "organization[auto_approve]", value === "auto" ? "enable" : "disable");
  includeCommit(form, body);
  return body;
}

function includeCommit(form: HtmlForm, body: URLSearchParams): void {
  const submit = control(form, "commit", "submit");
  if (submit && !submit.disabled) replaceFormField(body, "commit", submit.value);
}

function lifetimeBody(form: HtmlForm, value: LifetimePolicy): URLSearchParams {
  const body = formBody(form);
  replaceFormField(
    body,
    "organization[require_pat_to_expire]",
    value === "none" ? "0" : ["0", "1"],
  );
  if (value === "none") return body;
  const select = control(
    form,
    "organization[fine_grained_personal_access_token_expiration_limit]",
    "select",
  )!;
  const preset = select.options?.some((option) => option.value === String(value));
  replaceFormField(
    body,
    "organization[fine_grained_personal_access_token_expiration_limit]",
    preset ? String(value) : "custom",
  );
  replaceFormField(
    body,
    "organization[custom_fine_grained_personal_access_token_expiration_limit]",
    preset ? "" : String(value),
  );
  includeCommit(form, body);
  return body;
}

function publicPolicies(state: PatPolicyState) {
  return {
    access: state.policies.access,
    requests: state.policies.requests,
    maximumLifetime: state.policies.maximumLifetime,
  };
}

export async function showPatPolicy(client: WebSettingsClient, org: string) {
  const state = await readPatPolicy(client, org);
  return {
    account: client.account ?? "unknown",
    scope: "organization",
    target: org,
    operation: "pat-policy.show",
    mode: "read",
    sourcePage: new URL(state.page.url).pathname,
    method: "GET",
    changes: [],
    verified: true,
    policies: publicPolicies(state),
  };
}

export async function updatePatPolicy(
  client: WebSettingsClient,
  org: string,
  requested: RequestedPolicy,
  submit: boolean,
) {
  if (Object.values(requested).every((value) => value === undefined)) {
    throw new Error("Pass at least one of --access, --requests, or --max-lifetime.");
  }
  let state = await readPatPolicy(client, org);
  const unlocksDependentPolicies =
    state.policies.access.value === "restricted" && requested.access === "unrestricted";
  assertWritable(
    state,
    unlocksDependentPolicies ? { access: requested.access } : requested,
  );
  const changes = policyChanges(state, requested);
  const base = {
    account: client.account ?? "unknown",
    scope: "organization",
    target: org,
    operation: "pat-policy.update",
    mode: submit ? "submit" : "dry-run",
    sourcePage: new URL(state.page.url).pathname,
    method: "PATCH",
    changes,
    verified: false,
    policies: publicPolicies(state),
  };
  if (!submit || !changes.length) return { ...base, verified: changes.length === 0 };

  const applied: string[] = [];
  try {
    const applyAccess = async () => {
      if (requested.access === undefined || requested.access === state.policies.access.value) return;
      assertWritable(state, { access: requested.access });
      await client.submit(state.page, state.forms.access, accessBody(state.forms.access, requested.access));
      state = await readPatPolicy(client, org);
      if (state.policies.access.value !== requested.access) {
        throw new WebSettingsError(
          "verification_failed",
          `PAT access readback is ${state.policies.access.value}, expected ${requested.access}.`,
          state.page.url,
        );
      }
      applied.push("access");
    };
    const applyRequests = async () => {
      if (requested.requests === undefined || requested.requests === state.policies.requests.value) return;
      assertWritable(state, { requests: requested.requests });
      await client.submit(
        state.page,
        state.forms.requests,
        requestsBody(state.forms.requests, requested.requests),
      );
      state = await readPatPolicy(client, org);
      if (state.policies.requests.value !== requested.requests) {
        throw new WebSettingsError(
          "verification_failed",
          `PAT request readback is ${state.policies.requests.value}, expected ${requested.requests}.`,
          state.page.url,
        );
      }
      applied.push("requests");
    };
    const applyMaximumLifetime = async () => {
      if (
        requested.maximumLifetime === undefined ||
        requested.maximumLifetime === state.policies.maximumLifetime.value
      ) return;
      assertWritable(state, { maximumLifetime: requested.maximumLifetime });
      await client.submit(
        state.page,
        state.forms.lifetime,
        lifetimeBody(state.forms.lifetime, requested.maximumLifetime),
      );
      state = await readPatPolicy(client, org);
      if (state.policies.maximumLifetime.value !== requested.maximumLifetime) {
        throw new WebSettingsError(
          "verification_failed",
          `PAT lifetime readback is ${state.policies.maximumLifetime.value}, expected ${requested.maximumLifetime}.`,
          state.page.url,
        );
      }
      applied.push("maximumLifetime");
    };

    if (unlocksDependentPolicies) await applyAccess();
    await applyRequests();
    await applyMaximumLifetime();
    if (!unlocksDependentPolicies) await applyAccess();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WebSettingsError(
      error instanceof WebSettingsError ? error.code : "submission_rejected",
      applied.length
        ? `${message} Already verified before the failure: ${applied.join(", ")}.`
        : message,
      state.page.url,
      { applied },
    );
  }
  return {
    ...base,
    verified: true,
    applied,
    policies: publicPolicies(state),
  };
}

const showCommand = defineCommand({
  meta: { name: "show", description: "Show organization fine-grained PAT policies" },
  args: {
    org: { type: "positional", description: "Organization slug", required: true },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    printOutput(
      await showPatPolicy(await loadWebSettingsClient(), String(args.org)),
      getOutputFormat(args.output),
    );
  },
});

const updateCommand = defineCommand({
  meta: { name: "update", description: "Update organization fine-grained PAT policies" },
  args: {
    org: { type: "positional", description: "Organization slug", required: true },
    access: { type: "string", description: "restricted | unrestricted" },
    requests: { type: "string", description: "auto | manual" },
    "max-lifetime": { type: "string", description: "none or maximum lifetime in days" },
    yes: { type: "boolean", description: "Submit changes; omit for a dry run", default: false },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    const result = await updatePatPolicy(
      await loadWebSettingsClient(),
      String(args.org),
      requestedFromArgs(args),
      Boolean(args.yes),
    );
    printOutput(result, getOutputFormat(args.output));
    if (!args.yes && result.changes.length && getOutputFormat(args.output) !== "json") {
      console.log("Dry run only. Re-run with --yes to update the policies.");
    }
  },
});

export const patPolicyCommand = defineCommand({
  meta: { name: "pat-policy", description: "Manage organization fine-grained PAT policies" },
  subCommands: { show: showCommand, update: updateCommand },
});

export const __testing = {
  accessBody,
  lifetimeBody,
  parseLifetimeArgument,
  requestsBody,
};
