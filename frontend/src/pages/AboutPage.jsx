import { Link } from "react-router-dom";
export default function AboutPage() {
  return (
    <article className="page max-w-4xl">
      <p className="eyebrow">A NOTE FROM THE MUSEUM / 本馆说明</p>
      <h1 className="my-8 font-serif text-5xl">为数字往事，留一份档案。</h1>
      <div className="prose">
        <p>
          旧时博物馆是一个由社区共同维护的软件记忆档案。这里收藏的不是软件本身，而是它们曾经被打开的样子：安装界面、默认壁纸、更新日志，以及围绕它们的争论。
        </p>
        <h2>从一个系列开始</h2>
        <p>
          同一款软件的版本、截图与使用记忆，收录于同一个系列。不同平台的版本链独立整理，每个节点都可以补充界面资料、功能变化与来源链接。
        </p>
        <h2>让记忆有据可查</h2>
        <p>
          请注明图片与文字的来源，将个人回忆和已核实的事实区分开来。欢迎补充和纠错，每次版本编辑均保留修改前的正文和贡献者署名。
        </p>
        <h2>一起维护馆藏</h2>
        <p>
          领取通行证后，你可以收藏条目、创建系列、发布版本并参与讨论。还没完成的故事，可以先保存到自己的草稿中。
        </p>
        {import.meta.env.DEV && (
          <blockquote>
            当前为本地演示，缺失的业务接口由 MSW
            提供，演示数据保存在当前浏览器。初始馆藏数量仅作设计展示，版本节点以实际收录数据为准。
          </blockquote>
        )}
      </div>
      <Link className="button button-dark mt-8" to="/series">
        开始浏览馆藏 →
      </Link>
    </article>
  );
}
