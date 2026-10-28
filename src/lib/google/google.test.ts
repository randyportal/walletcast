import { generateKeyPairSync } from "node:crypto";
import { decodeJwt, decodeProtectedHeader, importSPKI, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import type { GoogleConfig } from "@/lib/config/env";
import type { Card, Subscriber } from "@/lib/db/schema";
import { DEFAULT_GOOGLE_CONFIG } from "@/lib/cards/google";
import { DEFAULT_CONTENT_CONFIG } from "@/lib/cards/content";
import { createGoogleWalletApi, createSaveUrl, GoogleWalletError, WALLET_API } from "./client";
import {
  buildGenericClass,
  buildGenericObject,
  buildNotifyMessage,
  buildObjectPatch,
  classId,
  objectId,
} from "./objects";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const google: GoogleConfig = {
  issuerId: "3388000000012345678",
  serviceAccount: { client_email: "wallet@proj.iam.gserviceaccount.com", private_key: privateKey },
};

const card = {
  id: "0b8f6c3e-1111-2222-3333-444455556666",
  slug: "lu",
  name: "Lu's Café",
  organizationName: "Lu",
  description: "Best coffee",
  welcomeText: "Welcome!",
  websiteUrl: "https://lu.example",
  bgColor: "#111827",
  fgColor: "#ffffff",
  labelColor: "#9ca3af",
  accentColor: "#4f46e5",
  backgroundType: "solid",
  bgColor2: null,
  gradientAngle: 135,
  backgroundImage: null,
  backgroundOverlay: 35,
  backgroundOverlayColor: "#000000",
  backgroundPosition: "center",
  fontFamily: "sans",
  iconSource: "auto",
  iconPreset: "",
  iconShape: "rounded",
  monogramText: "",
  favicon: null,
  links: [] as { id: string; label: string; url: string; icon: string; style: string }[],
  customFields: [] as { id: string; label: string; value: string; location: string }[],
  barcodeType: "qr",
  barcodeContent: "link",
  barcodeValue: null,
  logo: null,
  icon: null,
  latestMessage: null,
  latestMessageAt: null,
  dayGlow: false,
  glowSlot: null,
  contactUrl: null,
  logoText: "",
  headerLabel: "",
  headerValue: "",
  nameLabel: "",
  latestLabel: "LATEST",
  barcode: false,
  googleConfig: DEFAULT_GOOGLE_CONFIG,
  publicPageMode: "full",
  askEmail: true,
  createdAt: new Date(0),
  updatedAt: new Date(1000),
} as Card;

const subscriber = { serialNumber: "wc-abc_DEF-123" } as Subscriber;

describe("google object mapping", () => {
  it("builds stable ids", () => {
    expect(classId(google.issuerId, card)).toBe(`${google.issuerId}.wc_0b8f6c3e111122223333444455556666`);
    expect(objectId(google.issuerId, { serialNumber: "wc-a/b" })).toBe(`${google.issuerId}.wc-a_b`);
  });

  it("maps a card to a generic object", () => {
    const obj = buildGenericObject(google.issuerId, card, subscriber, "https://wc.test");
    expect(obj.classId).toBe(classId(google.issuerId, card));
    expect(obj.textModulesData[0]).toEqual({ id: "latest", header: "LATEST", body: "Welcome!" });
    expect(obj.logo.sourceUri.uri).toBe(`https://wc.test/api/cards/${card.id}/image/icon?v=1000&size=512`);
    expect(obj).not.toHaveProperty("wideLogo");
    expect(obj.linksModuleData).toEqual({ uris: [] });
    expect(obj.valueAddedModuleData).toHaveLength(1);

    const withLogo = buildGenericObject(google.issuerId, { ...card, logo: Buffer.from("x"), websiteUrl: null, description: "" }, subscriber, "https://wc.test");
    expect(withLogo).toHaveProperty("wideLogo");
    expect(withLogo.valueAddedModuleData).toBeUndefined();
    expect(withLogo.textModulesData).toHaveLength(1);
  });

  it("adds the share QR to Google objects when enabled", () => {
    expect(buildObjectPatch({ ...card, barcode: true }, "https://wc.test").barcode).toEqual({
      type: "QR_CODE",
      value: "https://wc.test/c/lu?src=pass",
    });
    expect(buildObjectPatch({ ...card, barcode: false }, "https://wc.test").barcode).toBeUndefined();
  });

  it("builds class, patch and message payloads", () => {
    expect(buildGenericClass(google.issuerId, card).id).toBe(classId(google.issuerId, card));
    expect(buildObjectPatch({ ...card, latestMessage: "Sale!" }, "https://wc.test").textModulesData[0].body).toBe("Sale!");
    expect(buildNotifyMessage("Hi", "There", "m1").message).toEqual({
      id: "m1",
      header: "Hi",
      body: "There",
      messageType: "TEXT_AND_NOTIFY",
    });
  });

  it("adds a hero image, link icons and custom fields", () => {
    const patch = buildObjectPatch(
      {
        ...card,
        backgroundType: "linear",
        links: [{ id: "l1", label: "Menu", subtitle: "", url: "https://menu.example", icon: "bag", style: "primary", iconAssetId: null, kind: "custom", visible: true }],
        customFields: [{ id: "f1", label: "Phone", value: "555 0100", location: "back" }],
      },
      "https://wc.test",
    );
    expect(patch.heroImage!.sourceUri.uri).toBe(`https://wc.test/api/cards/${card.id}/image/hero?v=1000`);
    const modules = patch.valueAddedModuleData as unknown as { header: { defaultValue: { value: string } }; image: { sourceUri: { uri: string } } }[];
    expect(modules.map((m) => m.header.defaultValue.value)).toContain("Menu");
    expect(modules.find((m) => m.header.defaultValue.value === "Menu")!.image.sourceUri.uri).toContain(`/link-icon/link%3Al1`);
    expect(patch.textModulesData).toContainEqual({ id: "cf_f1", header: "Phone", body: "555 0100" });
  });

  it("maps barcode types to Google formats", () => {
    expect(buildObjectPatch({ ...card, barcode: true, barcodeType: "pdf417" }, "https://wc.test").barcode!.type).toBe("PDF_417");
    expect(buildObjectPatch({ ...card, barcode: true, barcodeType: "aztec" }, "https://wc.test").barcode!.type).toBe("AZTEC");
    expect(buildObjectPatch({ ...card, barcode: true, barcodeType: "code128", barcodeContent: "custom", barcodeValue: "HELLO" }, "https://wc.test").barcode).toEqual({ type: "CODE_128", value: "HELLO" });
  });

  it("supports text and hidden code modes", () => {
    const text = buildObjectPatch(
      { ...card, googleConfig: { ...DEFAULT_GOOGLE_CONFIG, code: { mode: "text", text: "MEMBER 123" } } },
      "https://wc.test",
    );
    expect(text.barcode).toEqual({ alternateText: "MEMBER 123" });
    const hidden = buildObjectPatch(
      { ...card, barcode: true, googleConfig: { ...DEFAULT_GOOGLE_CONFIG, code: { mode: "hidden", text: "" } } },
      "https://wc.test",
    );
    expect(hidden.barcode).toBeUndefined();
  });

  it("adds the pass type and a front button", () => {
    const patch = buildObjectPatch(
      {
        ...card,
        googleConfig: {
          ...DEFAULT_GOOGLE_CONFIG,
          type: "business",
          button: { label: "Reservar", url: "https://book.example" },
        },
      },
      "https://wc.test",
    ) as unknown as {
      genericType: string;
      appLinkData: { displayText: { defaultValue: { value: string } }; webAppLinkInfo: { appTarget: { targetUri: { uri: string } } } };
    };
    expect(patch.genericType).toBe("GENERIC_OTHER");
    expect(patch.appLinkData.displayText.defaultValue.value).toBe("Reservar");
    expect(patch.appLinkData.webAppLinkInfo.appTarget.targetUri.uri).toBe("https://book.example");
  });

  it("adds extra text modules, value modules and an image module", () => {
    const patch = buildObjectPatch(
      {
        ...card,
        websiteUrl: null,
        googleConfig: {
          ...DEFAULT_GOOGLE_CONFIG,
          textModules: [{ id: "t1", header: "Horario", body: "9 a 18" }],
          valueModules: [{ id: "v1", header: "Reservar", body: "Cita online", url: "https://book.example", imageKind: "preset", icon: "calendar", assetId: null }],
          imageModule: { assetId: "asset-1", description: "Nuestro local" },
        },
      },
      "https://wc.test",
    ) as unknown as {
      textModulesData: { id: string }[];
      valueAddedModuleData: { header: { defaultValue: { value: string } } }[];
      imageModulesData: { mainImage: { sourceUri: { uri: string } } }[];
    };
    expect(patch.textModulesData.map((m) => m.id)).toContain("t_t1");
    expect(patch.valueAddedModuleData.map((m) => m.header.defaultValue.value)).toContain("Reservar");
    expect(patch.imageModulesData[0].mainImage.sourceUri.uri).toBe(`https://wc.test/api/cards/${card.id}/asset/asset-1`);
  });

  it("clears old link modules and keeps all recommendations", () => {
    const manyLinks = Array.from({ length: 12 }, (_, index) => ({
      id: `l${index}`,
      label: `Link ${index}`,
      subtitle: "",
      url: `https://example.com/${index}`,
      icon: "link" as const,
      style: "secondary" as const,
      iconAssetId: null,
      kind: "custom" as const,
      visible: true,
    }));
    const patch = buildObjectPatch({ ...card, websiteUrl: null, links: manyLinks }, "https://wc.test") as unknown as {
      linksModuleData: { uris: unknown[] };
      valueAddedModuleData: unknown[];
    };
    expect(patch.linksModuleData).toEqual({ uris: [] });
    expect(patch.valueAddedModuleData).toHaveLength(12);
  });

  it("hides the latest module, adds history and omits hidden recommendations", () => {
    const history = [
      { title: "Anterior", body: "Mensaje anterior", createdAt: new Date("2026-10-09T10:00:00Z") },
    ];
    const patch = buildObjectPatch(
      {
        ...card,
        websiteUrl: null,
        barcode: false,
        googleConfig: { ...DEFAULT_GOOGLE_CONFIG, code: { mode: "code", text: "" } },
        contentConfig: {
          version: 2,
          latest: { show: false, showHistory: true, historyTitle: "Historial", historyLimit: 5 },
          recommendations: { show: true, title: "Recomendaciones", iconBackground: "" },
        },
        links: [
          { id: "visible", label: "Visible", subtitle: "Sí", url: "https://visible.example", icon: "star", style: "secondary", iconAssetId: null, kind: "custom", visible: true },
          { id: "hidden", label: "Oculta", subtitle: "", url: "https://hidden.example", icon: "star", style: "secondary", iconAssetId: null, kind: "custom", visible: false },
        ],
      },
      "https://wc.test",
      history,
    ) as unknown as {
      barcode?: unknown;
      textModulesData: { id: string; header: string }[];
      valueAddedModuleData: { header: { defaultValue: { value: string } } }[];
    };
    expect(patch.barcode).toBeUndefined();
    expect(patch.textModulesData.map((module) => module.id)).not.toContain("latest");
    expect(patch.textModulesData).toContainEqual(expect.objectContaining({ id: "history", header: "Historial" }));
    expect(patch.valueAddedModuleData.map((module) => module.header.defaultValue.value)).toEqual(["Visible"]);
  });

  it("builds front rows from custom fields", () => {
    const withFront = { ...card, customFields: [{ id: "f1", label: "Socio", value: "123", location: "front" as const }] };
    const classObj = buildGenericClass(google.issuerId, withFront) as unknown as {
      classTemplateInfo: { cardTemplateOverride: { cardRowTemplateInfos: unknown[] } };
    };
    expect(classObj.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos).toHaveLength(2);
    const onlyFront = buildGenericClass(google.issuerId, {
      ...withFront,
      contentConfig: { ...DEFAULT_CONTENT_CONFIG, latest: { ...DEFAULT_CONTENT_CONFIG.latest, show: false } },
    }) as unknown as { classTemplateInfo: { cardTemplateOverride: { cardRowTemplateInfos: unknown[] } } };
    expect(onlyFront.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos).toHaveLength(1);
  });
});

function fakeFetch(responses: Record<string, number>) {
  const calls: { method: string; url: string; body?: string; auth?: string }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    const headers = init.headers as Record<string, string>;
    calls.push({ method, url, body: init.body as string | undefined, auth: headers.authorization });
    const status = responses[`${method} ${url.replace(WALLET_API, "")}`] ?? 200;
    return new Response(status === 200 ? "{}" : "nope", { status });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

describe("google wallet api", () => {
  const getAccessToken = async () => "tok";

  it("creates a class when it does not exist", async () => {
    const { calls, fetchFn } = fakeFetch({ "GET /genericClass/c1": 404 });
    await createGoogleWalletApi(google, { fetch: fetchFn, getAccessToken }).upsertGenericClass({ id: "c1" });
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
    expect(calls[1].url).toBe(`${WALLET_API}/genericClass`);
    expect(calls[0].auth).toBe("Bearer tok");
  });

  it("updates an existing class", async () => {
    const { calls, fetchFn } = fakeFetch({});
    await createGoogleWalletApi(google, { fetch: fetchFn, getAccessToken }).upsertGenericClass({ id: "c1" });
    expect(calls.map((c) => c.method)).toEqual(["GET", "PUT"]);
  });

  it("replaces an object with PUT when the design changes", async () => {
    const { calls, fetchFn } = fakeFetch({});
    await createGoogleWalletApi(google, { fetch: fetchFn, getAccessToken }).updateGenericObject("i.o1", { id: "i.o1" });
    expect(calls.map((c) => `${c.method} ${c.url.replace(WALLET_API, "")}`)).toEqual(["PUT /genericObject/i.o1"]);
  });

  it("patches objects and adds messages", async () => {
    const { calls, fetchFn } = fakeFetch({});
    const api = createGoogleWalletApi(google, { fetch: fetchFn, getAccessToken });
    await api.patchGenericObject("i.o1", { a: 1 });
    await api.addMessageToGenericObject("i.o1", { message: {} });
    expect(calls.map((c) => `${c.method} ${c.url.replace(WALLET_API, "")}`)).toEqual([
      "PATCH /genericObject/i.o1",
      "POST /genericObject/i.o1/addMessage",
    ]);
    expect(JSON.parse(calls[0].body!)).toEqual({ a: 1 });
  });

  it("raises GoogleWalletError on API errors", async () => {
    const { fetchFn } = fakeFetch({ "PATCH /genericObject/x": 403, "GET /genericClass/c": 500 });
    const api = createGoogleWalletApi(google, { fetch: fetchFn, getAccessToken });
    await expect(api.patchGenericObject("x", {})).rejects.toMatchObject({ name: "GoogleWalletError", status: 403 });
    await expect(api.upsertGenericClass({ id: "c" })).rejects.toBeInstanceOf(GoogleWalletError);
  });
});

describe("createSaveUrl", () => {
  it("returns a save link with a JWT signed by the service account", async () => {
    const obj = buildGenericObject(google.issuerId, card, subscriber, "https://wc.test");
    const url = await createSaveUrl(google, obj, "https://wc.test");
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const jwt = url.split("/").pop()!;
    expect(decodeProtectedHeader(jwt).alg).toBe("RS256");
    const { payload } = await jwtVerify(jwt, await importSPKI(publicKey, "RS256"), {
      issuer: google.serviceAccount.client_email,
      audience: "google",
    });
    expect(payload.typ).toBe("savetowallet");
    expect(payload.origins).toEqual(["https://wc.test"]);
    expect((decodeJwt(jwt).payload as { genericObjects: unknown[] }).genericObjects[0]).toEqual(obj);
  });
});
