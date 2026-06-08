from typing import Literal

from langgraph.graph import StateGraph, END

from agent.state import AgentState
from agent.nodes.router import router_node
from agent.nodes.rag import rag_node
from agent.nodes.grader import grader_node


def _route_after_router(state: AgentState) -> Literal["rag", "__end__"]:
    return "rag" if state.get("route") == "rag" else END  # type: ignore[return-value]


def _route_after_rag(state: AgentState) -> Literal["grader", "__end__"]:
    # cache hit → END (FastAPI will stream the cached answer)
    # no chunks → END (FastAPI calls generator with empty context)
    if state.get("cache_hit"):
        return END  # type: ignore[return-value]
    return "grader"


def build_graph() -> StateGraph:
    g: StateGraph = StateGraph(AgentState)

    g.add_node("router", router_node)
    g.add_node("rag", rag_node)
    g.add_node("grader", grader_node)

    g.set_entry_point("router")

    g.add_conditional_edges(
        "router",
        _route_after_router,
        {"rag": "rag", END: END},
    )
    g.add_conditional_edges(
        "rag",
        _route_after_rag,
        {"grader": "grader", END: END},
    )
    g.add_edge("grader", END)

    return g.compile()


graph = build_graph()
