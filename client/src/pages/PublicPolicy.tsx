import { Link } from "wouter";
import { ArrowLeft, FileText, LockKeyhole, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PolicyKind = "privacy" | "terms" | "dataDeletion";

const CONTACT_EMAIL = "xintian2769@gmail.com";
const CONTACT_PHONE = "012-431 1232";
const CONTACT_ADDRESS = "No 31, Jalan Pantai Jerjak 5, Taman Pantai Jerjak, 11700 Gelugor, Pulau Pinang, Malaysia";

const policyContent: Record<PolicyKind, {
  icon: typeof LockKeyhole;
  eyebrow: string;
  title: string;
  englishTitle: string;
  lead: string;
  sections: Array<{ heading: string; body: string[] }>;
}> = {
  privacy: {
    icon: LockKeyhole,
    eyebrow: "XinTian Garden · Privacy Policy",
    title: "隐私政策",
    englishTitle: "Privacy Policy",
    lead: "本政策说明心田花圃（ECOLAND NURSERY）在商城、Facebook 专页及 Messenger 服务中如何收集、使用、保存和保护客户资料。",
    sections: [
      {
        heading: "我们可能收集的资料",
        body: [
          "为回应咨询、处理订单、配送、付款核对及售后服务，我们可能处理您自愿提供的姓名、联系电话、配送地址、订单内容、付款凭据，以及您通过 Facebook、Messenger 或商城发送的讯息。",
          "当您通过 Facebook 或 Messenger 联系我们时，我们只会使用平台提供且与您互动所必需的资料，例如公开显示名称、讯息内容及与订单相关的识别资料。",
        ],
      },
      {
        heading: "资料的使用目的",
        body: [
          "我们使用资料来回应您的查询、建立或核对订单、安排配送或自取、审核付款凭据、处理退款或售后事项，以及在您提出请求或服务有必要时联络您。",
          "我们不会出售您的个人资料。除为完成配送、付款处理、系统托管或依法必须披露外，我们不会将个人资料提供给无关第三方。",
        ],
      },
      {
        heading: "保存与保护",
        body: [
          "我们采取合理的行政和技术措施限制只有获授权人员可接触与业务处理有关的资料。资料会在完成订单、处理争议、履行法定义务或维持必要业务记录所需期间内保存。",
          "请勿通过 Messenger 或公开留言传送银行卡密码、身份证完整号码或其他不必要的敏感资料。",
        ],
      },
      {
        heading: "您的选择与联络方式",
        body: [
          `您可要求查阅、更正或删除我们持有的与您有关资料，或询问本政策。请电邮至 ${CONTACT_EMAIL}，或通过 WhatsApp／电话 ${CONTACT_PHONE} 与我们联系。为保护帐户安全，我们可能先核对您的身份与请求范围。`,
          "如您要求删除 Facebook 或 Messenger 相关资料，请使用本网站的「用户资料删除说明」页面所列步骤；我们会在完成身份核对后处理。",
        ],
      },
    ],
  },
  terms: {
    icon: FileText,
    eyebrow: "XinTian Garden · Terms of Service",
    title: "服务条款",
    englishTitle: "Terms of Service",
    lead: "使用心田花圃商城、Facebook 专页或 Messenger 服务，即表示您同意以下与查询、订单、付款及配送有关的基本服务条款。",
    sections: [
      {
        heading: "订单与资料确认",
        body: [
          "客户应提供准确的姓名、电话、配送或自取资料。系统或客服发送的草稿、订单请求、报价或付款指示，须以后台审核和正式订单记录为准。",
          "商品供应、植物状态、规格、配送可行性及最终运费会在实际处理订单时再次确认；如出现缺货、资料不完整或其他无法履约的情况，我们会联系客户讨论替代、等待、退款或取消安排。",
        ],
      },
      {
        heading: "付款与配送",
        body: [
          "付款状态以经审核的付款记录为准。客户上传的汇款凭据会进入审核流程，并不代表系统已经确认收款或安排发货。",
          "配送服务、时段、风险和费用会依订单资料及服务地区而定。西马配送的运费规则以结账页面及订单明细显示为准；东马、Lalamove、自取或其他特殊安排会按所选方式另行处理。",
        ],
      },
      {
        heading: "沟通与可接受使用",
        body: [
          "请以礼貌和真实资料使用本服务。不得冒用他人身份、提交伪造付款凭据、干扰系统、发送恶意内容或试图绕过订单与付款审核。",
          "我们可因安全、疑似欺诈、资料明显错误、滥用服务或法律要求而暂停处理有关请求，并在合理可行时说明后续处理方式。",
        ],
      },
      {
        heading: "条款更新与联络",
        body: [
          "我们可能随业务流程或法规需要更新本条款，并在本页面更新日期。若您对订单、条款或服务有疑问，请先通过 Messenger、WhatsApp／电话或电邮与我们联系。",
          `营业资料：ECOLAND NURSERY，${CONTACT_ADDRESS}。联络电邮：${CONTACT_EMAIL}。`,
        ],
      },
    ],
  },
  dataDeletion: {
    icon: Trash2,
    eyebrow: "XinTian Garden · Data Deletion Instructions",
    title: "用户资料删除说明",
    englishTitle: "User Data Deletion Instructions",
    lead: "如您希望删除与 XinTian Garden Facebook 专页、Messenger 对话或商城服务有关的个人资料，可依以下方式提出请求。",
    sections: [
      {
        heading: "提出删除请求的方法",
        body: [
          `请电邮至 ${CONTACT_EMAIL}，主题填写「删除我的资料」；或通过 WhatsApp／电话 ${CONTACT_PHONE} 联系我们。请说明您使用的 Facebook／Messenger 显示名称、联络号码或订单编号，以及希望删除的资料范围。`,
          "请勿在删除请求中提供银行卡密码、完整身份证号码或其他不必要的敏感资料。",
        ],
      },
      {
        heading: "身份核对与处理范围",
        body: [
          "为防止他人删除您的资料，我们会以合理方式核对请求者与有关帐户或订单的关系。核对完成后，我们会删除或去识别化不再需要的 Messenger 对话资料、客户联系资料或其他可删除的个人资料。",
          "部分资料在合理必要范围内可能仍需保留，例如已完成交易的付款、税务、会计、争议处理、防欺诈或法律合规记录。保留资料仅用于该等目的，并不会再用于一般营销。",
        ],
      },
      {
        heading: "处理结果",
        body: [
          "我们会在收到完整请求并完成身份核对后，尽快处理，并以您提交请求的联络方式通知结果或说明仍须保留的资料类别。",
          `如您只想停止接收后续 Messenger 信息，也可直接在对话中发送「停止」或联络我们说明；如需完全删除资料，请按本页面的删除请求步骤办理。`,
        ],
      },
    ],
  },
};

export default function PublicPolicy({ kind }: { kind: PolicyKind }) {
  const policy = policyContent[kind];
  const Icon = policy.icon;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f4f7ef] via-white to-[#f8f7f3] px-4 py-8 text-slate-800 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/mall" className="inline-flex items-center gap-2 text-sm font-semibold text-[#35664a] hover:underline">
            <ArrowLeft className="h-4 w-4" /> 返回心田商城
          </Link>
          <nav aria-label="公开政策" className="flex flex-wrap gap-2 text-xs font-medium">
            <Link href="/privacy-policy" className={kind === "privacy" ? "rounded-full bg-[#35664a] px-3 py-1.5 text-white" : "rounded-full border border-[#a9c3a8] bg-white px-3 py-1.5 text-[#35664a] hover:bg-[#edf5ea]"}>隐私政策</Link>
            <Link href="/terms-of-service" className={kind === "terms" ? "rounded-full bg-[#35664a] px-3 py-1.5 text-white" : "rounded-full border border-[#a9c3a8] bg-white px-3 py-1.5 text-[#35664a] hover:bg-[#edf5ea]"}>服务条款</Link>
            <Link href="/data-deletion" className={kind === "dataDeletion" ? "rounded-full bg-[#35664a] px-3 py-1.5 text-white" : "rounded-full border border-[#a9c3a8] bg-white px-3 py-1.5 text-[#35664a] hover:bg-[#edf5ea]"}>资料删除</Link>
          </nav>
        </div>

        <Card className="overflow-hidden border-[#d9e6d4] bg-white shadow-xl shadow-[#35664a]/10">
          <div className="border-b border-[#d9e6d4] bg-[#edf5ea] px-6 py-7 sm:px-10 sm:py-9">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#35664a] text-white shadow-sm"><Icon className="h-5 w-5" /></div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4e7f59]">{policy.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#254834] sm:text-4xl">{policy.title}</h1>
            <p className="mt-1 text-sm font-semibold text-[#4e7f59]">{policy.englishTitle}</p>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">{policy.lead}</p>
          </div>
          <CardContent className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
            {policy.sections.map((section) => (
              <section key={section.heading} className="border-l-4 border-[#91b594] pl-4 sm:pl-5">
                <h2 className="text-lg font-bold text-[#254834]">{section.heading}</h2>
                <div className="mt-2 space-y-3 text-sm leading-7 text-slate-700 sm:text-base">
                  {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
            <section className="rounded-2xl bg-[#f5f8f2] p-5 text-sm leading-6 text-slate-700">
              <h2 className="font-bold text-[#254834]">联络资料</h2>
              <p className="mt-2">ECOLAND NURSERY · 心田花圃</p>
              <p>{CONTACT_ADDRESS}</p>
              <p>电话／WhatsApp：{CONTACT_PHONE} · 电邮：{CONTACT_EMAIL}</p>
              <p className="mt-3 text-xs text-slate-500">最后更新：2026 年 8 月 15 日</p>
            </section>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="border-[#91b594] bg-white text-[#35664a] hover:bg-[#edf5ea]"><Link href="/mall">浏览心田商城</Link></Button>
        </div>
      </div>
    </main>
  );
}
