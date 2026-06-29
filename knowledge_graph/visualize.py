from pyvis.network import Network
from knowledge_graph.graph_builder import IndAIGraph

COLORS = {
    "Equipment": "#F0A500",
    "Document":  "#4A7FA5",
    "Failure":   "#F85149",
    "Date":      "#3FB950",
    "Node":      "#8B949E",
}

def generate_html_graph(output_path: str = "knowledge_graph/graph.html"):
    graph = IndAIGraph()
    data  = graph.get_graph_data()
    graph.close()

    net = Network(height="600px", width="100%", bgcolor="#0d1117", font_color="#e6edf3")
    net.barnes_hut(gravity=-8000, central_gravity=0.3, spring_length=150)

    id_map = {}
    for node in data["nodes"]:
        label    = node.get("_label", "Node")
        node_id  = node["_id"]
        name     = node.get("name") or node.get("id") or node.get("type") or node.get("value") or str(node_id)
        color    = COLORS.get(label, "#8B949E")
        size     = 30 if label == "Equipment" else 20 if label == "Document" else 15

        net.add_node(node_id, label=name, color=color, size=size,
                     title=f"{label}: {name}", font={"size": 12})
        id_map[node_id] = name

    for rel in data["relationships"]:
        net.add_edge(rel["source"], rel["target"], label=rel["type"],
                     color="#2a3348", font={"size": 9, "color": "#8b949e"})

    net.save_graph(output_path)
    print(f"Graph saved to {output_path}")
    return output_path