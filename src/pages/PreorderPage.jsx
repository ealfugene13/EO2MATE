import PreorderAdminPage from "./PreorderAdminPage";
export default function PreorderPage({ client, navigateTo }) {
  return (<>
            <section className="selling-tabs">
              <div>
                <button type="button" className="primary-button">Dashboard / Summary</button>
                <button type="button" className="secondary-button" onClick={() => navigateTo("pre-order-create")}>Create Post</button>
              </div>
            </section>
            <PreorderAdminPage client={client} onCreatePost={() => navigateTo("pre-order-create")} />
          </>);
}
